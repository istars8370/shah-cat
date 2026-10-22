// SHAH CAT Gate 2B: browser read-only quote lifecycle tests, no real Phantom calls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ShahCat from "./shared.js";

const shared=readFileSync(new URL("./shared.js",import.meta.url),"utf8");
const config=readFileSync(new URL("./project-config.js",import.meta.url),"utf8");
const connectors=readFileSync(new URL("./wallet-connectors.js",import.meta.url),"utf8");
const script=readFileSync(new URL("./wallet.js",import.meta.url),"utf8");
const A="3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B="9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const key=value=>({toBase58:()=>value});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(){
  const elements=new Map(),requests=[],events={};
  const document={getElementById(id){
    if(!elements.has(id))elements.set(id,{
      value:"",textContent:"",disabled:false,hidden:false,
      addEventListener(event,callback){this[event]=callback;},
      replaceChildren(){},append(){},
    });
    return elements.get(id);
  },createElement(){return {};}};
  const provider={
    isPhantom:true,connect:async()=>({publicKey:key(A)}),disconnect:async()=>{},
    on(name,callback){events[name]=callback;},
    signTransaction(){assert.fail("No signature allowed");},
    signAndSendTransaction(){assert.fail("No send allowed");},
    signMessage(){assert.fail("No message signing allowed");},
  };
  vm.runInNewContext(config+"\n"+shared+"\n"+connectors+"\n"+script,{
    document,window:{phantom:{solana:provider}},URLSearchParams,encodeURIComponent,
    fetch:url=>new Promise(resolve=>requests.push({url,resolve})),
  });
  const el=id=>document.getElementById(id);
  const respond=(index,details,ok=true)=>requests[index].resolve({
    ok,json:async()=>details,
  });
  const connect=async()=>{
    await el("connectWallet").click();
    respond(0,{
      network:"devnet",mint:ShahCat.MINT,decimals:9,
      address:A,shahRaw:"100000000000",shah:"100",solLamports:"50000000",
      checkedAt:new Date().toISOString(),
    });
    await flush();
    el("sendTo").value=B;
    el("sendAmount").value="1";
  };
  const quote=(overrides={})=>({
    network:"devnet",mint:ShahCat.MINT,decimals:9,
    sender:A,recipient:B,rawAmount:"1000000000",quantity:"1",
    recipientAta:B,sourceTokenAccount:A,
    recipientAtaExists:true,requiresAtaCreation:false,
    feeLamports:"5000",rentLamports:"0",
    feeSol:"0.000005",rentSol:"0",totalPlannedSolLamports:"5000",
    simulationPassed:true,signatureEnabled:false,broadcastingEnabled:false,
    checkedAt:new Date().toISOString(),...overrides,
  });
  return {el,events,requests,connect,respond,quote};
}
test("read-only quote displays RPC-derived fee but does not request Phantom signature",async()=>{
  const w=fixture();await w.connect();
  const pending=w.el("checkQuote").click();
  assert.match(w.requests[1].url,/^\/api\/quote\?/);
  assert.equal(w.el("checkQuote").disabled,true);
  w.respond(1,w.quote());
  await pending;
  assert.match(w.el("quoteMessage").textContent,/서명 없는 Devnet 시뮬레이션 통과/);
  assert.match(w.el("quoteMessage").textContent,/0.000005 SOL/);
  assert.equal(w.el("checkQuote").disabled,false);
});
test("input mutation invalidates late read-only quote response",async()=>{
  const w=fixture();await w.connect();
  const pending=w.el("checkQuote").click();
  w.el("sendAmount").value="2";w.el("sendAmount").input();
  w.respond(1,w.quote());await pending;
  assert.match(w.el("quoteMessage").textContent,/무효화/);
});
test("disconnect cancels quote and prevents stale confirmation",async()=>{
  const w=fixture();await w.connect();
  const pending=w.el("checkQuote").click();
  await w.el("disconnectWallet").click();
  w.respond(1,w.quote());await pending;
  assert.match(w.el("quoteMessage").textContent,/무효화/);
});
test("account switch cancels quote even when outstanding HTTP request succeeds",async()=>{
  const w=fixture();await w.connect();
  const pending=w.el("checkQuote").click();
  w.events.accountChanged(key(B));
  w.respond(1,w.quote());await pending;
  assert.match(w.el("quoteMessage").textContent,/무효화/);
  w.respond(2,{network:"devnet",mint:ShahCat.MINT,decimals:9,
    address:B,shahRaw:"0",shah:"0",solLamports:"50000000",checkedAt:new Date().toISOString()});
  await flush();
});
test("rejects mismatched network, incorrect price total, stale timestamp, and sign-enabled response",async()=>{
  const variations=[
    {network:"mainnet-beta"},
    {totalPlannedSolLamports:"6000"},
    {checkedAt:"2000-01-01T00:00:00.000Z"},
    {signatureEnabled:true},
  ];
  for(const override of variations){
    const w=fixture();await w.connect();
    const pending=w.el("checkQuote").click();
    w.respond(1,w.quote(override));await pending;
    assert.match(w.el("quoteMessage").textContent,/견적 내용 또는 조회 시각이 일치하지 않습니다/);
  }
});
test("simulation RPC error remains failure state and no result is shown as success",async()=>{
  const w=fixture();await w.connect();
  const pending=w.el("checkQuote").click();
  w.respond(1,{error:"RPC simulation rejected"},false);
  await pending;
  assert.match(w.el("quoteMessage").textContent,/RPC simulation rejected/);
  assert.doesNotMatch(w.el("quoteMessage").textContent,/시뮬레이션 통과/);
});

