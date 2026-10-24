import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import Policy from "./tokenomics.js";
import ShahCat from "./shared.js";
const scripts = ["project-config.js","shared.js","tokenomics.js","tokenomics-ui.js"]
  .map(name => readFileSync(new URL(name,import.meta.url),"utf8")).join("\n");
const A=ShahCat.OWNERS[0].address,B=ShahCat.OWNERS[1].address;
function fixture() {
  const elements=new Map(),requests=[],downloads=[];
  const node=()=>({value:"",textContent:"",disabled:false,children:[],
    append(child){this.children.push(child);},replaceChildren(){this.children=[];},
    addEventListener(name,fn){this[name]=fn;},click(){},
  });
  const el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
  el("vestingMonth").value="0";
  vm.runInNewContext(scripts,{
    document:{getElementById:el,createElement:node},URLSearchParams,AbortController,Date,Blob,
    URL:{createObjectURL(blob){downloads.push(blob);return "blob:report";},revokeObjectURL(){}},setTimeout(fn){fn();},
    fetch:(url,opts)=>new Promise((resolve,reject)=>requests.push({url,opts,resolve,reject})),
  });
  const submit=()=>el("allocationForm").submit({preventDefault(){}});
  const response=(index,data,ok=true)=>requests[index].resolve({ok,json:async()=>data});
  return {el,requests,submit,response,downloads};
}
function report(address=A,raw="0") {
  return {policyVersion:"0.5",network:"devnet",mint:Policy.MINT,decimals:9,networkVerified:true,
    checkedAt:new Date().toISOString(),supplyRaw:String(Policy.TOTAL_RAW),supplyMatchesPolicy:true,
    signatureEnabled:false,broadcastingEnabled:false,
    members:Policy.MEMBERS.map(x=>({id:x.id,name:x.name,role:x.role,targetRaw:String(Policy.rawTarget(x.id)),
      address:x.id==="seongjae"?address:null,identityVerified:false,allocationVerified:false,lockVerified:false,
      status:x.id==="seongjae"?"observed":"unconfigured",heldRaw:null,deltaRaw:null,relation:null,slot:null,
      ...(x.id==="seongjae"?{...Policy.difference(x.id,raw),frozenRaw:"0",slot:123}:{}),
    })),
  };
}
test("UI starts offline with 37 preview rows and unknown actual balances",()=>{
  const w=fixture();assert.equal(w.requests.length,0);assert.equal(w.el("vestingSchedule").children.length,37);
  assert.match(w.el("vestingReleased").textContent,/16,666,666.6/);
  assert.equal(w.el("allocationResults").children[0].children[2].textContent,"—");
});
test("UI month boundaries and invalid input never retain stale projected numbers",()=>{
  const w=fixture();
  for(const [month,value] of [["12","91,666,666.3"],["24","333,333,333"],["36","500,000,000"]]){
    w.el("vestingMonth").value=month;w.el("vestingMonth").input();assert.equal(w.el("vestingReleased").textContent,value+" SHAH");
  }
  w.el("vestingMonth").value="";w.el("vestingMonth").input();assert.equal(w.el("vestingReleased").textContent,"—");
});
test("empty and duplicate addresses are rejected locally without contacting RPC",async()=>{
  const w=fixture();await w.submit();assert.equal(w.requests.length,0);
  w.el("allocationAddress-seongjae").value=A;w.el("allocationAddress-dongwon").value=A;
  await w.submit();assert.equal(w.requests.length,0);assert.match(w.el("allocationMessage").textContent,/같은 주소/);
});
test("observed zero is displayed as zero and exported with verification flags false",async()=>{
  const w=fixture();w.el("allocationAddress-seongjae").value=A;const pending=w.submit();
  assert.match(w.requests[0].url,/^\/api\/allocations\?seongjae=/);w.response(0,report());await pending;
  const cells=w.el("allocationResults").children[0].children;
  assert.equal(cells[2].textContent,"0");assert.match(cells[4].textContent,/소유자 미확인/);
  assert.equal(w.el("downloadAllocationAudit").disabled,false);w.el("downloadAllocationAudit").click();
  const csv=await w.downloads[0].text();assert.match(csv,/identity_verified/);assert.match(csv,/"false","false","false"/);
});
test("changing an address invalidates old data, export and a late successful request",async()=>{
  const w=fixture();w.el("allocationAddress-seongjae").value=A;const first=w.submit();
  w.el("allocationAddress-seongjae").value=B;w.el("allocationAddress-seongjae").input();
  w.response(0,report(A,"100"));await first;
  assert.equal(w.el("allocationResults").children[0].children[2].textContent,"—");
  assert.equal(w.el("downloadAllocationAudit").disabled,true);
  const second=w.submit();w.response(1,report(B,"200"));await second;
  assert.equal(w.el("allocationResults").children[0].children[2].textContent,"0.0000002");
  w.el("allocationAddress-seongjae").value=A;w.el("allocationAddress-seongjae").input();
  assert.equal(w.el("allocationResults").children[0].children[2].textContent,"—");
  assert.equal(w.el("downloadAllocationAudit").disabled,true);
});
test("an older failed request cannot change new results or re-enable a pending button",async()=>{
  const w=fixture();w.el("allocationAddress-seongjae").value=A;const first=w.submit();
  w.el("allocationAddress-seongjae").value=B;w.el("allocationAddress-seongjae").input();const second=w.submit();
  w.requests[0].reject(Error("old request"));await first;
  assert.equal(w.el("auditAllocations").disabled,true);
  w.response(1,report(B));await second;assert.equal(w.el("auditAllocations").disabled,false);
});
test("mismatched network, address, target arithmetic or identity claims fail closed",async()=>{
  const mutations=[x=>x.network="mainnet",x=>x.mint=A,x=>x.members[0].address=B,
    x=>x.members[0].deltaRaw="1",x=>x.signatureEnabled=true,x=>x.members[0].identityVerified=true,
    x=>x.members.push(x.members[0])];
  for(const mutate of mutations){
    const w=fixture();w.el("allocationAddress-seongjae").value=A;const pending=w.submit();const data=report();mutate(data);
    w.response(0,data);await pending;assert.equal(w.el("downloadAllocationAudit").disabled,true);
    assert.equal(w.el("allocationResults").children[0].children[2].textContent,"—");
  }
});
