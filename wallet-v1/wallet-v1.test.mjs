import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ShahCat from "../dashboard/shared.js";
import { walletHistory } from "./history.mjs";
import { createWalletRequestHandler } from "./server.mjs";
const require=createRequire(import.meta.url);
const Model=require("./model.js");
const A="3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B="9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const Mint=ShahCat.MINT;
const tokenAddress="F87mh5nbBsUF264cUjqnpb7auy3W1yH413nMShgpjv3J";
const signature="2ebZBf6aTRJVfJJHzDKr98UMv13FmV9zwngSQnoCG5rnyyr7e2xAum5YPNkDrypATRyzMQUQwNHvtV6bpGXw2BK7";
const now=Date.now();
const balance={network:"devnet",address:A,mint:Mint,decimals:9,shahRaw:"12300000000",solLamports:"50000000",checkedAt:new Date(now).toISOString()};
const quote={network:"devnet",sender:A,recipient:B,mint:Mint,decimals:9,
  rawAmount:"1000000000",simulationPassed:true,signatureEnabled:false,broadcastingEnabled:false,
  recipientAtaExists:false,requiresAtaCreation:true,sourceTokenAccount:A,recipientAta:tokenAddress,
  feeLamports:"5000",rentLamports:"1488440",totalPlannedSolLamports:"1493440",
  checkedAt:new Date(now).toISOString()};
test("wallet model rejects malformed, duplicated, and unknown contacts",()=>{
  assert.deepEqual(Model.normalizeContacts([{label:" Home ",address:A},{label:"Duplicate",address:A},{label:"Bad",address:"not a key"}],ShahCat.isPublicKey),[{label:"Home",address:A}]);
  const item=Model.addContact([],"Home",A,ShahCat.isPublicKey);
  assert.equal(item[0].address,A);
  assert.throws(()=>Model.addContact(item,"again",A,ShahCat.isPublicKey),/이미/);
  assert.throws(()=>Model.addContact([], "bad","seed phrase here",ShahCat.isPublicKey),/공개 주소/);
  assert.throws(()=>Model.addContact([], "x".repeat(41),B,ShahCat.isPublicKey),/1~40자/);
  assert.throws(()=>Model.addContact(Array(20).fill({label:"Test",address:A}),"X",B,ShahCat.isPublicKey),/최대/);
});
test("wallet balance verification requires exact network, wallet, mint, and timestamp",()=>{
  const result=Model.validBalance(balance,A,ShahCat,now);
  assert.equal(result.shah,12300000000n);
  assert.equal(result.sol,50000000n);
  assert.throws(()=>Model.validBalance({...balance,network:"mainnet-beta"},A,ShahCat,now),/일치/);
  assert.throws(()=>Model.validBalance({...balance,shahRaw:"not-a-number"},A,ShahCat,now));
  assert.throws(()=>Model.validBalance({...balance,checkedAt:"2000-01-01T00:00:00.000Z"},A,ShahCat,now),/오래/);
});
test("unsigned quote requires no signing, matching fee sum and inputs",()=>{
  const expected={sender:A,recipient:B,rawAmount:1000000000n};
  assert.equal(Model.validQuote(quote,expected,ShahCat,now).rent,1488440n);
  assert.throws(()=>Model.validQuote({...quote,signatureEnabled:true},expected,ShahCat,now),/검증값/);
  assert.throws(()=>Model.validQuote({...quote,broadcastingEnabled:true},expected,ShahCat,now),/검증값/);
  assert.throws(()=>Model.validQuote({...quote,totalPlannedSolLamports:"5000"},expected,ShahCat,now),/합계/);
  assert.throws(()=>Model.validQuote({...quote,recipient:B}, {...expected,recipient:A},ShahCat,now),/검증값/);
  assert.throws(()=>Model.validQuote({...quote,checkedAt:"2000-01-01T00:00:00.000Z"},expected,ShahCat,now),/유효 시간/);
});
function rpcForHistory(){
  const calls=[];
  const f=async(method,params)=>{
    calls.push(method);
    if(method==="getGenesisHash")return ShahCat.DEVNET_GENESIS;
    if(method==="getTokenAccountsByOwner")return {value:[{pubkey:tokenAddress}]};
    if(method==="getSignaturesForAddress")return [{signature,blockTime:1761200000,err:null}];
    if(method==="getTransaction")return {
      blockTime:1761200000,meta:{err:null,
        preTokenBalances:[{mint:Mint,owner:A,uiTokenAmount:{decimals:9,amount:"20000000000"}}],
        postTokenBalances:[{mint:Mint,owner:A,uiTokenAmount:{decimals:9,amount:"17000000000"}}],
      },
    };
    assert.fail("Unexpected RPC method: "+method);
  };
  return {f,calls};
}
test("real read-only history logic retrieves last SHA​H token delta for connected wallet",async()=>{
  const {f,calls}=rpcForHistory();
  const out=await walletHistory(A,f);
  assert.equal(out.network,"devnet");
  assert.equal(out.limited,true);
  assert.equal(out.transactions.length,1);
  assert.equal(out.transactions[0].direction,"출금");
  assert.equal(out.transactions[0].amount,"3");
  assert.equal(out.transactions[0].signature,signature);
  assert.deepEqual(calls,["getGenesisHash","getTokenAccountsByOwner","getSignaturesForAddress","getTransaction"]);
  assert.equal(calls.includes("sendTransaction"),false);
});
test("wrong Devnet genesis and invalid wallet fail before account reads",async()=>{
  let calls=0;
  await assert.rejects(walletHistory("invalid",async()=>{calls++;}),/Invalid/);
  assert.equal(calls,0);
  await assert.rejects(walletHistory(A,async()=> "mainnet-beta"),/Devnet/);
});
test("history rejects incorrect precision and ignores failed/non-SHAH transactions",async()=>{
  const {f}=rpcForHistory();
  const malformed=async(method,params)=>{
    const value=await f(method,params);
    if(method==="getTransaction")value.meta.postTokenBalances[0].uiTokenAmount.decimals=6;
    return value;
  };
  await assert.rejects(walletHistory(A,malformed),/precision mismatch/);
  const none=async(method,params)=>{
    const value=await f(method,params);
    if(method==="getTransaction")value.meta.err={InstructionError:[0,"Failed"]};
    return value;
  };
  const data=await walletHistory(A,none);
  assert.equal(data.transactions.length,0);
});
test("wallet UI history verification rejects wrong address, signature and extra rows",()=>{
  const row={signature,direction:"출금",rawAmount:"3000000000",amount:"3",timestamp:new Date(now).toISOString()};
  const hist={network:"devnet",mint:Mint,address:A,limited:true,checkedAt:new Date(now).toISOString(),transactions:[row]};
  assert.equal(Model.validHistory(hist,A,ShahCat,now).length,1);
  assert.throws(()=>Model.validHistory({...hist,address:B},A,ShahCat,now),/유효하지/);
  assert.throws(()=>Model.validHistory({...hist,transactions:[{...row,signature:"<script>"}]},A,ShahCat,now),/잘못된/);
  assert.throws(()=>Model.validHistory({...hist,transactions:[{...row,amount:"999"}]},A,ShahCat,now),/잘못된/);
  assert.throws(()=>Model.validHistory({...hist,transactions:Array(13).fill(row)},A,ShahCat,now),/유효하지/);
});
function fakeResponse(){
  return { status:null,headers:null,body:"",
    writeHead(status,headers){this.status=status;this.headers=headers;},
    end(body){this.body=String(body);}
  };
}
test("localhost wallet server serves static branded wallet with restrictive CSP",async()=>{
  const handler=createWalletRequestHandler(async()=> ShahCat.DEVNET_GENESIS,async()=>{throw Error("fallback should not be needed");});
  const res=fakeResponse();await handler({method:"GET",url:"/"},res);
  assert.equal(res.status,200);
  assert.match(res.body,/SHAH Wallet/);
  assert.match(res.headers["content-security-policy"],/script-src 'self'/);
  assert.match(res.body,/sendDisabled/);
  for(const url of ["/wallet-v1.css","/wallet-v1.js","/wallet-v1-model.js"]){
    const response=fakeResponse();await handler({method:"GET",url},response);
    assert.equal(response.status,200,url);
  }
  const denied=fakeResponse();await handler({method:"POST",url:"/api/wallet-history"},denied);
  assert.equal(denied.status,405);
});
test("localhost wallet history API is GET-only and rejects invalid addresses",async()=>{
  const handler=createWalletRequestHandler(async()=> ShahCat.DEVNET_GENESIS,async()=>{throw Error("fallback should not be needed");});
  const invalid=fakeResponse();await handler({method:"GET",url:"/api/wallet-history?address=not-valid"},invalid);
  assert.equal(invalid.status,400);
  assert.match(invalid.body,/Invalid/);
});

test("wallet 1.0 controller cannot invoke any signing or broadcasting method",()=>{
  const source=readFileSync(new URL("./wallet.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/\.(?:signTransaction|signAndSendTransaction|sendTransaction|sendRawTransaction|signMessage|signAllTransactions)\s*\(/);
  assert.match(source,/sendDisabled/);
  assert.match(source,/invalidateQuote/);
});
