import test from "node:test";
import assert from "node:assert/strict";
import ShahCat from "./shared.js";
import {
  TOKEN_PROGRAM, ATA_PROGRAM, decode58, encode58, isOnCurve,
  deriveAssociatedTokenAddress, compileLegacyMessage, unsignedWireTransaction,
  quoteUnsignedTransfer,
} from "./transfer-quote.mjs";
import { createRequestHandler } from "./server.mjs";

const A="3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B="9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const SOURCE="So11111111111111111111111111111111111111112";
const BLOCKHASH="11111111111111111111111111111111";
const ATA=deriveAssociatedTokenAddress(B);
const token=(owner,raw="2000000000",state="initialized",mint=ShahCat.MINT)=>({
  owner:TOKEN_PROGRAM,data:{parsed:{type:"account",info:{
    owner,mint,state,tokenAmount:{amount:raw,decimals:9},
  }}},
});
const mockMint = {owner:TOKEN_PROGRAM,data:{parsed:{type:"mint",info:{decimals:9,isInitialized:true}}}};
function mockQuery(options={}) {
  const calls=[];
  const query=async (method,params)=>{
    calls.push({method,params});
    if(method in options) {
      const value=options[method];
      return typeof value==="function"?value(params,calls):value;
    }
    switch(method) {
      case "getGenesisHash":return ShahCat.DEVNET_GENESIS;
      case "getBalance":return {value:50000000};
      case "getTokenAccountsByOwner":return {value:[{
        pubkey:SOURCE,account:{data:{parsed:{info:{
          owner:A,mint:ShahCat.MINT,state:"initialized",
          tokenAmount:{amount:"2000000000",decimals:9},
        }}}},
      }]};
      case "getAccountInfo":
        if(params[0]===ShahCat.MINT)return {value:mockMint};
        if(params[0]===SOURCE)return {value:token(A)};
        if(params[0]===ATA)return {value:token(B)};
        assert.fail("Unexpected getAccountInfo: "+params[0]);
      case "getLatestBlockhash":return {value:{blockhash:BLOCKHASH,lastValidBlockHeight:1000}};
      case "getFeeForMessage":return {value:5000};
      case "simulateTransaction":return {value:{err:null,unitsConsumed:1798}};
      default:assert.fail("Unexpected RPC: "+method);
    }
  };
  return {query,calls};
}
const input={sender:A,recipient:B,quantity:"1"};
test("Base58 and recipient ATA derivation maintain canonical key semantics",()=>{
  for(const address of [A,B,SOURCE,TOKEN_PROGRAM,ATA_PROGRAM,ShahCat.MINT,BLOCKHASH]){
    assert.equal(encode58(decode58(address)),address);
  }
  assert.equal(isOnCurve(decode58(A)),true);
  assert.equal(isOnCurve(decode58(B)),true);
  assert.equal(isOnCurve(decode58(ATA)),false);
  assert.equal(deriveAssociatedTokenAddress(B),ATA);
  assert.notEqual(deriveAssociatedTokenAddress(A),ATA);
});
test("rejects PDA recipient (non-wallet) without exposing signing methods",async()=>{
  const {query,calls}=mockQuery();
  await assert.rejects(quoteUnsignedTransfer({...input,recipient:ATA},query),/on-curve wallet/);
  assert.ok(!calls.some(x=>x.method==="simulateTransaction"));
});
test("legacy message compiles one wallet signer with zero serialized signatures",()=>{
  const message=compileLegacyMessage(A,BLOCKHASH,[{
    programId:TOKEN_PROGRAM,keys:[{pubkey:A,signer:true,writable:true}],data:Buffer.from([12]),
  }]);
  assert.equal(message[0],1);
  assert.equal(message[1],0);
  assert.equal(message[3],2);
  const wire=unsignedWireTransaction(message);
  assert.equal(wire[0],1);
  assert.deepEqual(wire.subarray(1,65),Buffer.alloc(64));
  assert.deepEqual(wire.subarray(65),message);
});
test("existing ATA quote retrieves real RPC message fee and unsigned simulation",async()=>{
  const {query,calls}=mockQuery();
  const v=await quoteUnsignedTransfer(input,query);
  assert.equal(v.recipientAta,ATA);
  assert.equal(v.recipientAtaExists,true);
  assert.equal(v.requiresAtaCreation,false);
  assert.equal(v.feeLamports,"5000");
  assert.equal(v.rentLamports,"0");
  assert.equal(v.totalPlannedSolLamports,"5000");
  assert.equal(v.simulationPassed,true);
  assert.equal(v.signatureEnabled,false);
  assert.equal(v.broadcastingEnabled,false);
  assert.ok(!calls.some(x=>x.method==="getMinimumBalanceForRentExemption"));
  const msg=Buffer.from(calls.find(x=>x.method==="getFeeForMessage").params[0],"base64");
  assert.equal(msg[0],1);
  const rpc=calls.find(x=>x.method==="simulateTransaction");
  assert.equal(rpc.params[1].sigVerify,false);
  assert.equal(rpc.params[1].replaceRecentBlockhash,false);
  const wire=Buffer.from(rpc.params[0],"base64");
  assert.deepEqual(wire.subarray(1,65),Buffer.alloc(64));
  assert.deepEqual(wire.subarray(65),msg);
  assert.ok(!calls.some(x=>/sendTransaction|sendRawTransaction|signTransaction|requestAirdrop/.test(x.method)));
});
test("missing ATA includes create-idempotent instruction and rent deposit",async()=>{
  const {query,calls}=mockQuery({
    getAccountInfo: params => params[0]===ShahCat.MINT?{value:mockMint}:params[0]===SOURCE?{value:token(A)}:{value:null},
    getMinimumBalanceForRentExemption:2039280,
  });
  const v=await quoteUnsignedTransfer(input,query);
  assert.equal(v.recipientAtaExists,false);
  assert.equal(v.requiresAtaCreation,true);
  assert.equal(v.rentLamports,"2039280");
  assert.equal(v.totalPlannedSolLamports,"2044280");
  assert.equal(calls.filter(x=>x.method==="getMinimumBalanceForRentExemption").length,1);
  const msg=Buffer.from(calls.find(x=>x.method==="getFeeForMessage").params[0],"base64");
  assert.ok(msg.includes(decode58(ATA_PROGRAM)));
});
test("wrong RPC network fails before reading account balances",async()=>{
  const {query,calls}=mockQuery({getGenesisHash:"mainnet"});
  await assert.rejects(quoteUnsignedTransfer(input,query),/only Solana Devnet/);
  assert.deepEqual(calls.map(x=>x.method),["getGenesisHash"]);
});
test("Token-2022 mint owner mismatch fails closed",async()=>{
  const {query,calls}=mockQuery({getAccountInfo:params=>params[0]===ShahCat.MINT
    ?{value:{owner:ATA_PROGRAM,data:mockMint.data}}:{value:token(A)}});
  await assert.rejects(quoteUnsignedTransfer(input,query),/not an initialized legacy/);
  assert.ok(!calls.some(x=>x.method==="getFeeForMessage"));
});
test("drifting source token balance fails closed",async()=>{
  const {query}=mockQuery({getAccountInfo:params=>params[0]===ShahCat.MINT?{value:mockMint}:{value:token(A,"0")}});
  await assert.rejects(quoteUnsignedTransfer(input,query),/balance changed/);
});
test("frozen, misowned and wrong-mint destination ATA fail closed",async()=>{
  for(const destination of [token(B,"0","frozen"),token(A),token(B,"100","initialized",SOURCE)]){
    const {query,calls}=mockQuery({getAccountInfo:params=>
      params[0]===ShahCat.MINT?{value:mockMint}:params[0]===SOURCE?{value:token(A)}:{value:destination}});
    await assert.rejects(quoteUnsignedTransfer(input,query),/Recipient ATA has unexpected/);
    assert.ok(!calls.some(x=>x.method==="simulateTransaction"));
  }
});
test("null, negative, fractional, oversized RPC fee and simulation error fail closed",async()=>{
  for(const fee of [null,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
    const {query}=mockQuery({getFeeForMessage:{value:fee}});
    await assert.rejects(quoteUnsignedTransfer(input,query),/Invalid network fee/);
  }
  const {query}=mockQuery({simulateTransaction:{value:{err:{InstructionError:[0,"Custom"]}}}});
  await assert.rejects(quoteUnsignedTransfer(input,query),/unsigned simulation failed/);
});
test("actual fee plus reserve cannot exceed sender SOL",async()=>{
  const {query}=mockQuery({getBalance:{value:10000001}});
  await assert.rejects(quoteUnsignedTransfer(input,query),/Insufficient Devnet SOL/);
});
test("network changes between quoting and simulation prevent execution",async()=>{
  let n=0;
  const {query,calls}=mockQuery({getGenesisHash:()=>++n===1?ShahCat.DEVNET_GENESIS:"mainnet"});
  await assert.rejects(quoteUnsignedTransfer(input,query),/cluster changed/);
  assert.ok(!calls.some(x=>x.method==="simulateTransaction"));
});
test("quote endpoint is GET only and bad addresses trigger no RPC",async()=>{
  const {query,calls}=mockQuery();
  const send=async(url,method="GET")=>{
    let status=0,body;
    await createRequestHandler(query)({url,method},{writeHead(x){status=x;},end(x){body=x;}});
    return {status,body};
  };
  const url="/api/quote?sender="+A+"&recipient="+B+"&amount=1";
  const v=await send(url);
  assert.equal(v.status,200);
  assert.equal(JSON.parse(v.body).simulationPassed,true);
  const total=calls.length;
  assert.equal((await send(url,"POST")).status,405);
  assert.equal((await send("/api/quote?sender=bad&recipient="+B+"&amount=1")).status,400);
  assert.equal(calls.length,total);
});


test("mint initialization must be explicitly true before further RPC work",async()=>{
  for(const initialized of [undefined,null,false,0,1,"true"]){
    const info={decimals:9};
    if(initialized!==undefined)info.isInitialized=initialized;
    const {query,calls}=mockQuery({getAccountInfo:()=>({value:{
      owner:TOKEN_PROGRAM,data:{parsed:{type:"mint",info}},
    }})});
    await assert.rejects(quoteUnsignedTransfer(input,query),/not an initialized legacy/);
    assert.deepEqual(calls.filter(x=>x.method==="getAccountInfo").map(x=>x.params[0]),[ShahCat.MINT]);
    assert.ok(!calls.some(x=>x.method==="getFeeForMessage"||x.method==="simulateTransaction"));
  }
});

test("second SOL lookup rejects malformed values before simulation",async()=>{
  for(const value of [undefined,null,-1,1.5,Number.MAX_SAFE_INTEGER+1,"50000000",true,NaN,Infinity]){
    let reads=0;
    const {query,calls}=mockQuery({getBalance:()=>++reads===1?{value:50000000}:{value}});
    await assert.rejects(quoteUnsignedTransfer(input,query),/Invalid SOL balance response/);
    assert.equal(reads,2);
    assert.ok(!calls.some(x=>x.method==="simulateTransaction"));
  }
});

test("refreshed SOL at the exact fee plus reserve boundary succeeds",async()=>{
  let reads=0;
  const {query}=mockQuery({getBalance:()=>({value:++reads===1?50000000:10005000})});
  const result=await quoteUnsignedTransfer(input,query);
  assert.equal(reads,2);
  assert.equal(result.simulationPassed,true);
});

test("simulation success requires an explicit null error",async()=>{
  for(const simulation of [undefined,null,{}, {value:null},{value:[]},{value:{}},
    {value:{err:undefined}},{value:{err:false}},{value:{err:0}},{value:{err:""}}]){
    const {query}=mockQuery({simulateTransaction:simulation});
    await assert.rejects(quoteUnsignedTransfer(input,query),/Invalid simulation RPC response|unsigned simulation failed/);
  }
});

test("quote HTTP response fails closed for an incomplete simulation result",async()=>{
  const {query}=mockQuery({simulateTransaction:{value:{}}});
  let status,body;
  await createRequestHandler(query)({method:"GET",url:"/api/quote?sender="+A+"&recipient="+B+"&amount=1"},
    {writeHead(value){status=value;},end(value){body=value;}});
  assert.equal(status,502);
  const result=JSON.parse(body);
  assert.equal(result.error,"Devnet data unavailable or invalid");
  assert.equal(Object.hasOwn(result,"simulationPassed"),false);
});
