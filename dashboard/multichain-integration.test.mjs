import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ShahCat from "./shared.js";
import { createRequestHandler } from "./server.mjs";
import { createWalletRequestHandler } from "../wallet-v1/server.mjs";
import { readMultiChainBalance } from "../wallet-v1/multichain.mjs";

const repoUrl = url => new URL(url, import.meta.url);
const A="3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const EVM="0x1111111111111111111111111111111111111111";
const dashboard=readFileSync(repoUrl("./index.html"),"utf8");

function response() {
  return {status:0,headers:{},body:null,
    writeHead(status,headers){this.status=status;this.headers=headers;},
    end(body){this.body=Buffer.isBuffer(body)?body.toString("utf8"):String(body||"");},
  };
}
async function request(handler,method,url){
  const res=response();
  await handler({method,url},res);
  return res;
}

test("dashboard contains wallet entry, segmented Mainnet watch panel and stable existing Devnet IDs",()=>{
  assert.match(dashboard, /href="\/wallet"/);
  assert.match(dashboard, /href="#multichain-section"/);
  assert.match(dashboard, /id="multichain-section"/);
  assert.match(dashboard, /SHAH Devnet 잔액과 합산하지 않습니다/);
  for(const id of ["mcNetwork","mcAddress","mcRead","mcAssets","mcConnectEvm","mcCopyConnected","mcNotice","mcVerified","mcChecked","walletAddress","walletSelect","sendAmount","checkQuote","supply","ledger","transfers"]){
    assert.ok(dashboard.includes('id="'+id+'"'),"Missing "+id);
  }
  const ids=[...dashboard.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,"All dashboard IDs must remain unique");
  for(const script of ["/shared.js","/multichain-registry.js","/multichain-ui.js","/dashboard-multichain.js"]){
    assert.ok(dashboard.includes('src="'+script+'"'),"Missing "+script);
  }
  assert.ok(dashboard.indexOf('src="/multichain-registry.js"')<dashboard.indexOf('src="/multichain-ui.js"'),"Load chain registry before UI");
  assert.ok(dashboard.indexOf('src="/multichain-ui.js"')<dashboard.indexOf('src="/dashboard-multichain.js"'),"Load shared UI before dashboard bridge");
});
test("dashboard server serves branded wallet on the SAME origin with strict page CSP and static assets",async()=>{
  const core=createRequestHandler(async()=>{throw Error("Unexpected RPC");},async()=>{throw Error("Unexpected external");});
  const routes=[
    ["/", "SHAH CAT | Devnet Dashboard","text/html"],
    ["/wallet","SHAH Wallet","text/html"],
    ["/wallet/index.html","SHAH Wallet","text/html"],
    ["/wallet-v1.css","SHAH CAT original","text/css"],
    ["/wallet-v1.js","watchOnly","text/javascript"],
    ["/wallet-v1-model.js","validBalance","text/javascript"],
    ["/multichain-registry.js","solana-mainnet","text/javascript"],
    ["/multichain-ui.js","eth_requestAccounts","text/javascript"],
    ["/dashboard-multichain.js","mcCopyConnected","text/javascript"],
  ];
  for(const [path,marker,type] of routes){
    const res=await request(core,"GET",path);
    assert.equal(res.status,200,path);
    assert.ok(res.headers["content-type"].includes(type),path+" content type");
    assert.ok(res.body.includes(marker),path+" missing expected content");
    assert.equal(res.headers["x-content-type-options"],"nosniff");
    if(path==="/wallet"){
      assert.match(res.headers["content-security-policy"],/script-src 'self'/);
      assert.match(res.headers["content-security-policy"],/frame-ancestors 'none'/);
      assert.match(res.body,/sendDisabled"[^>]*disabled/);
    }
  }
  const denied=await request(core,"POST","/wallet");
  assert.equal(denied.status,405,"No POST access from Dashboard to wallet");
});
test("same dashboard and standalone wallet servers provide matching read-only multichain API",async()=>{
  const seen=[];
  const dummyRead=async(chain,address)=>{
    seen.push({chain,address});
    return {network:"mainnet",chain,address,readOnly:true,walletSigningEnabled:false,broadcastingEnabled:false,assets:[]};
  };
  const dashboardServer=createRequestHandler(async()=>{throw Error("Unexpected Devnet RPC");},async()=>{throw Error("Unexpected fetch");},dummyRead);
  const walletServer=createWalletRequestHandler(async()=>{throw Error("Unexpected Devnet history");},dashboardServer,dummyRead);
  for(const handler of [dashboardServer,walletServer]){
    const res=await request(handler,"GET","/api/multichain?chain=base&address="+EVM);
    assert.equal(res.status,200);
    const payload=JSON.parse(res.body);
    assert.deepEqual({network:payload.network,chain:payload.chain,address:payload.address},{network:"mainnet",chain:"base",address:EVM});
    assert.equal(payload.walletSigningEnabled,false);
    assert.equal(payload.broadcastingEnabled,false);
    assert.equal(payload.readOnly,true);
    assert.equal(res.headers["x-content-type-options"],"nosniff");
    const rejected=await request(handler,"POST","/api/multichain?chain=base&address="+EVM);
    assert.equal(rejected.status,405);
  }
  assert.equal(seen.length,2);
  const unsupported=await request(createRequestHandler(),"GET","/api/multichain?chain=untrusted&address="+EVM);
  assert.equal(unsupported.status,400,"Unlisted chains fail closed before RPC");
});
test("dashboard bridge copies ONLY public Solana address and invalidates old Mainnet quotes",()=>{
  const script=readFileSync(repoUrl("./dashboard-multichain.js"),"utf8");
  const handlers=new Map(),elements=new Map();
  function el(id){
    if(!elements.has(id)){
      const item={value:"",textContent:"",disabled:false,
        addEventListener(name,fn){handlers.set(id+"."+name,fn);},
        dispatchEvent(event){const h=handlers.get(id+"."+event.type);if(h)h(event);},
      };
      elements.set(id,item);
    }
    return elements.get(id);
  }
  el("walletAddress").textContent=A;el("mcNetwork").value="solana-mainnet";
  let watcher=null;
  class FakeObserver{
    constructor(fn){watcher=fn;}
    observe(){}
  }
  class FakeEvent{constructor(type){this.type=type;}}
  vm.runInNewContext(script,{document:{getElementById:el},ShahCat,MutationObserver:FakeObserver,Event:FakeEvent});
  assert.equal(el("mcCopyConnected").disabled,false);
  handlers.get("mcCopyConnected.click")();
  assert.equal(el("mcAddress").value,A);
  assert.match(el("mcNotice").textContent,/공개 주소만 복사/);
  el("mcNetwork").value="ethereum";handlers.get("mcNetwork.change")();
  assert.equal(el("mcCopyConnected").disabled,true);
  el("walletAddress").textContent="연결 안 됨";watcher();
  assert.equal(el("mcCopyConnected").disabled,true);
});
test("Dashboard and wallet Mainnet modules contain no transaction or wallet-signature execution calls",()=>{
  for(const path of ["dashboard-multichain.js","../wallet-v1/multichain-ui.js"]){
    const code=readFileSync(repoUrl("./"+path),"utf8");
    assert.doesNotMatch(code,/\.(?:sendTransaction|sendRawTransaction|signMessage|signTransaction|signAndSendTransaction|signAllTransactions)\s*\(/);
    assert.doesNotMatch(code,/["'](?:eth_sendTransaction|eth_sendRawTransaction|personal_sign|eth_sign|wallet_switchEthereumChain)["']/);
  }
  assert.equal(ShahCat.NETWORK.cluster,"devnet");
});
