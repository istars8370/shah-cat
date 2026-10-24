import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {readMultiChainBalance,queryReadOnly} from "./multichain.mjs";
import {createWalletRequestHandler} from "./server.mjs";
import ShahCat from "../dashboard/shared.js";
const require=createRequire(import.meta.url);
const M=require("./multichain-registry.js");
const EVM="0x1111111111111111111111111111111111111111";
const SOL="3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const token=(issuer,number)=>"0x"+BigInt(number).toString(16).padStart(64,"0");
function fakeEvm(id){
  const calls=[];
  async function query(chain,method,params){
    calls.push({chain:chain.id,method,params});
    if(method==="eth_chainId")return "0x"+id.toString(16);
    if(method==="eth_getBalance")return "0xde0b6b3a7640000"; // 1 native ETH/POL
    if(method==="eth_call"){
      const contract=params[0]?.to?.toLowerCase();
      const a=chain.tokens.find(x=>x.contract.toLowerCase()===contract);
      assert.ok(a,"Only allowlisted contracts may be queried");
      assert.equal(params[0].data,"0x70a08231"+EVM.slice(2).padStart(64,"0"));
      assert.equal(params[1],"latest");
      return token(a.issuer,a.id==="usdc"?1_250_000n:5_000_000n);
    }
    assert.fail("Unexpected RPC "+method);
  }
  return {query,calls};
}
test("issuer-pinned token contract addresses are immutable and chain-specific",()=>{
  const sol=M.getChain("solana-mainnet");
  const eth=M.getChain("ethereum");
  const base=M.getChain("base");
  const polygon=M.getChain("polygon");
  assert.equal(Object.isFrozen(M.chains),true);
  assert.equal(sol.genesis,"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  assert.deepEqual(sol.tokens.map(x=>x.symbol),["USDC","USDT"]);
  assert.equal(sol.tokens[0].mint,"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  assert.equal(sol.tokens[1].mint,"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
  assert.deepEqual(eth.tokens.map(x=>x.symbol),["USDC","USDT"]);
  assert.deepEqual(base.tokens.map(x=>x.symbol),["USDC"]);
  assert.deepEqual(polygon.tokens.map(x=>x.symbol),["USDC"]);
  assert.equal(eth.tokens[1].contract.toLowerCase(),"0xdac17f958d2ee523a2206206994597c13d831ec7");
  assert.equal(base.tokens[0].contract.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  assert.equal(polygon.tokens[0].contract.toLowerCase(),"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359");
  assert.throws(()=>M.getChain("bsc"),/지원하지/);
});
test("EVM public address and bigint precision have no floating point rounding",()=>{
  assert.equal(M.isEvmAddress(EVM),true);
  assert.equal(M.parseEvmAddress("0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD"),"0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  assert.throws(()=>M.parseEvmAddress("ETH account 0x..."),/0x/);
  assert.equal(M.formatUnits(1234567n,6),"1.234567");
  assert.equal(M.formatUnits(1000000000000000000n,18),"1");
  assert.equal(M.formatUnits(1230000000000000000000000n,18),"1230000");
  assert.equal(M.formatUnits(0n,6),"0");
});
for(const [chain,id,native] of [["ethereum",1,"ETH"],["base",8453,"ETH"],["polygon",137,"POL"]]){
  test("read-only "+chain+" balanceOf uses chain ID and exact token allowlist",async()=>{
    const {query,calls}=fakeEvm(id);
    const result=await readMultiChainBalance(chain,EVM,query);
    assert.equal(result.network,"mainnet");
    assert.equal(result.readOnly,true);
    assert.equal(result.walletSigningEnabled,false);
    assert.equal(result.broadcastingEnabled,false);
    assert.equal(result.assets[0].symbol,native);
    assert.equal(result.assets[0].amount,"1");
    assert.equal(result.assets[1].symbol,"USDC");
    assert.equal(result.assets[1].amount,"1.25");
    if(chain==="ethereum")assert.equal(result.assets[2].symbol,"USDT");
    assert.equal(calls[0].method,"eth_chainId");
    assert.equal(calls[1].method,"eth_getBalance");
    assert.deepEqual(calls.slice(2).map(x=>x.method),result.assets.slice(1).map(()=>"eth_call"));
    assert.equal(calls.filter(x=>/send|sign|personal/.test(x.method)).length,0);
  });
}
test("EVM chain mismatch fails before any balance calls",async()=>{
  const {query,calls}=fakeEvm(1);
  await assert.rejects(readMultiChainBalance("base",EVM,query),/Chain ID/);
  assert.deepEqual(calls.map(x=>x.method),["eth_chainId"]);
});
test("EVM wrong address, malformed ERC-20 return and invalid RPC numbers are rejected",async()=>{
  await assert.rejects(readMultiChainBalance("ethereum",SOL,fakeEvm(1).query),/EVM/);
  await assert.rejects(readMultiChainBalance("ethereum",EVM,async(chain,method)=>{
    if(method==="eth_chainId")return "0x1";
    if(method==="eth_getBalance")return "0xg";
    return "0x"+("0".repeat(64));
  }),/Malformed/);
  await assert.rejects(readMultiChainBalance("ethereum",EVM,async(chain,method)=>{
    if(method==="eth_chainId")return "0x1";
    if(method==="eth_getBalance")return "0x0";
    return "0x1";
  }),/32 bytes/);
});
function solana(){
  const calls=[];
  const query=async(chain,method,params)=>{
    calls.push({method,params});
    if(method==="getGenesisHash")return chain.genesis;
    if(method==="getBalance")return {value:3210000000};
    if(method==="getTokenAccountsByOwner"){
      const mint=params[1].mint;
      if(mint===M.getChain("solana-mainnet").tokens[0].mint)
        return {value:[{account:{owner:"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",data:{
          parsed:{type:"account",info:{owner:SOL,mint,tokenAmount:{amount:"9876543",decimals:6}}}}}}]};
      return {value:[]};
    }
    assert.fail("unexpected Solana RPC "+method);
  };
  return {query,calls};
}
test("Solana Mainnet returns SOL, USDC and USDT, separate from SHAH Devnet",async()=>{
  const {query,calls}=solana();
  const result=await readMultiChainBalance("solana-mainnet",SOL,query);
  assert.equal(result.assets.length,3);
  assert.deepEqual(result.assets.map(x=>x.symbol),["SOL","USDC","USDT"]);
  assert.deepEqual(result.assets.map(x=>x.amount),["3.21","9.876543","0"]);
  assert.equal(result.network,"mainnet");
  assert.ok(result.assets.every(x=>x.symbol!=="SHAH"));
  assert.deepEqual(calls.map(x=>x.method),["getGenesisHash","getBalance","getTokenAccountsByOwner","getTokenAccountsByOwner"]);
});
test("Solana wrong genesis, token owner, token mint or decimal mismatches fail closed",async()=>{
  const {query,calls}=solana();
  await assert.rejects(readMultiChainBalance("solana-mainnet",SOL,async(chain,method,params)=>method==="getGenesisHash"?"incorrect":query(chain,method,params)),/genesis/);
  assert.equal(calls.length,0);
  await assert.rejects(readMultiChainBalance("solana-mainnet",SOL,async(chain,method,params)=>{
    const response=await query(chain,method,params);
    if(method==="getTokenAccountsByOwner"&&response.value.length)response.value[0].account.data.parsed.info.tokenAmount.decimals=9;
    return response;
  }),/mismatch/);
});
test("RPC proxy only contacts fixed endpoints and refuses transaction/signing methods",async()=>{
  const chain=M.getChain("ethereum");
  let n=0;
  const result=await queryReadOnly(chain,"eth_chainId",[],async(url,opts)=>{
    n++;
    assert.equal(url,chain.rpc);
    assert.equal(opts.method,"POST");
    assert.deepEqual(JSON.parse(opts.body).params,[]);
    return {ok:true,text:async()=>JSON.stringify({jsonrpc:"2.0",id:1,result:"0x1"})};
  });
  assert.equal(result,"0x1");
  assert.equal(n,1);
  await assert.rejects(queryReadOnly(chain,"eth_sendTransaction",[],async()=>{throw Error("must not call");}),/not allowed/);
  await assert.rejects(queryReadOnly(chain,"personal_sign",[],async()=>{throw Error("must not call");}),/not allowed/);
  await assert.rejects(queryReadOnly(chain,"wallet_switchEthereumChain",[],async()=>{throw Error("must not call");}),/not allowed/);
  await assert.rejects(queryReadOnly(chain,"getBalance",[],async()=>{throw Error("must not call");}),/not valid/);
});
test("multichain API is GET only, uses allowlisted chain and keeps Core Dashboard unchanged",async()=>{
  const input=[];const fake=async(chain,address)=>{
    input.push({chain,address});return {chain,address,network:"mainnet",assets:[]};
  };
  const handler=createWalletRequestHandler(async()=>{throw Error("no history");},async()=>{throw Error("no core");},fake);
  function res(){return{status:0,body:"",headers:null,writeHead(code,headers){this.status=code;this.headers=headers;},end(body){this.body=String(body);}}}
  const ok=res();await handler({method:"GET",url:"/api/multichain?chain=ethereum&address="+EVM},ok);
  assert.equal(ok.status,200);
  assert.deepEqual(input,[{chain:"ethereum",address:EVM}]);
  assert.match(ok.headers["content-security-policy"],/script-src 'self'/);
  const forbidden=res();await handler({method:"POST",url:"/api/multichain"},forbidden);
  assert.equal(forbidden.status,405);
});
test("browser screen renders mainnet separately with no send/swap calls",()=>{
  const html=readFileSync(new URL("./index.html",import.meta.url),"utf8");
  const ui=readFileSync(new URL("./multichain-ui.js",import.meta.url),"utf8");
  assert.match(html,/id="multichain-section"/);
  assert.match(html,/id="mcNetwork"/);
  assert.match(html,/id="sendDisabled"[^>]*disabled/);
  assert.match(html,/shahBalance/);
  assert.match(html,/SHAH Devnet 잔액과 합산하지 않습니다/);
  assert.match(ui,/eth_requestAccounts/);
  assert.doesNotMatch(ui,/["'](?:eth_sendTransaction|personal_sign|eth_sign|wallet_switchEthereumChain)["']/);
  assert.doesNotMatch(ui,/\.(?:sendTransaction|sendRawTransaction|signTransaction|signMessage|signAndSendTransaction)\s*\(/);
  assert.match(ui,/textContent/);
});

test("wallet approval arriving after Solana chain switch does not mix EVM address into Solana view",async()=>{
  const js=readFileSync(new URL("./multichain-ui.js",import.meta.url),"utf8");
  const elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,{
      id,value:id==="mcNetwork"?"ethereum":"",disabled:false,hidden:false,
      textContent:"",className:"",children:[],
      addEventListener(type,fn){this[type]=fn;},
      replaceChildren(){this.children=[];},
      append(child){this.children.push(child);},
    });
    return elements.get(id);
  }
  let approve;
  const pending=new Promise(resolve=>{approve=resolve;});
  const window={
    ethereum:{request:async({method})=>{
      assert.equal(method,"eth_requestAccounts");
      return pending;
    }},
    addEventListener(){},
  };
  const document={getElementById:element,createElement:()=>({
    textContent:"",className:"",children:[],append(child){this.children.push(child);}
  })};
  vm.runInNewContext(js,{window,document,ShahMultiChains:M,ShahCat,
    URLSearchParams,fetch:async()=>{throw Error("No network calls in this test");}});
  const task=element("mcConnectEvm").click();
  element("mcNetwork").value="solana-mainnet";
  element("mcNetwork").change();
  approve([EVM]);
  await task;
  assert.equal(element("mcAddress").value,"");
  assert.equal(element("mcConnectEvm").disabled,true);
});
test("existing dashboard link is routed through the original dashboard handler",async()=>{
  let coreCalled=0;
  const core=async(req,res)=>{
    coreCalled++;
    assert.equal(req.method,"GET");
    assert.equal(req.url,"/");
    res.writeHead(200,{"content-type":"text/html"});res.end("Original Dashboard");
  };
  const handler=createWalletRequestHandler(async()=>{throw Error("no history");},core);
  const output={status:0,body:"",writeHead(code){this.status=code;},end(text){this.body=text;}};
  await handler({url:"/dashboard",method:"GET"},output);
  assert.equal(coreCalled,1);
  assert.equal(output.status,200);
  assert.equal(output.body,"Original Dashboard");
});

test("unknown chain name fails as client input error without calling RPC",async()=>{
  let called=false;
  await assert.rejects(readMultiChainBalance("malicious-chain",EVM,async()=>{called=true;}),error=>error.status===400);
  assert.equal(called,false);
});
