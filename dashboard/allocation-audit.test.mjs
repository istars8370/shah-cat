import test from "node:test";
import assert from "node:assert/strict";
import { auditAllocations } from "./allocation-audit.mjs";
import { createRequestHandler } from "./server.mjs";
import ShahCat from "./shared.js";
const A=ShahCat.OWNERS[0].address, B=ShahCat.OWNERS[1].address, C=ShahCat.MINT;
function account(address, raw, pubkey=A, state="initialized") {
  return { pubkey, account: { owner:ShahCat.TOKEN.programId, data:{ parsed:{type:"account", info:{
    owner:address,mint:C,state,tokenAmount:{amount:String(raw),decimals:9},
  }} } } };
}
function fixture(overrides={}) {
  const calls=[];
  const query=async (method,params) => {
    calls.push([method,params]);
    if (Object.hasOwn(overrides,method)) return typeof overrides[method]==="function" ? overrides[method](params) : overrides[method];
    if(method==="getGenesisHash")return ShahCat.DEVNET_GENESIS;
    if(method==="getAccountInfo")return { value:{owner:ShahCat.TOKEN.programId,data:{parsed:{type:"mint",info:{isInitialized:true,decimals:9,supply:"1000000000000000000"}}}} };
    if(method==="getTokenAccountsByOwner")return {context:{slot:123},value:[]};
    assert.fail("Unexpected RPC "+method);
  };
  return {query,calls};
}
test("unconfigured addresses remain unknown with no RPC and no invented T0 or balance", async()=>{
  const {query,calls}=fixture();const result=await auditAllocations({},query);
  assert.equal(calls.length,0);assert.equal(result.networkVerified,false);assert.equal(result.checkedAt,null);
  for(const member of result.members){assert.equal(member.status,"unconfigured");assert.equal(member.heldRaw,null);assert.equal(member.deltaRaw,null);}
});
test("invalid, duplicate and unknown mappings are rejected before RPC",async()=>{
  for(const input of [{seongjae:"bad"},{seongjae:A,dongwon:A},{other:A},{seongjae:1}]){
    const {query,calls}=fixture();await assert.rejects(auditAllocations(input,query),e=>e.status===400);assert.equal(calls.length,0);
  }
});
test("non-Devnet RPC is blocked before reading mint or balances",async()=>{
  const {query,calls}=fixture({getGenesisHash:"mainnet"});
  await assert.rejects(auditAllocations({parkwon:A},query),/only Solana Devnet/);
  assert.deepEqual(calls.map(x=>x[0]),["getGenesisHash"]);
});
test("mint owner, precision and supply are validated",async()=>{
  for(const value of [null,{owner:A,data:{parsed:{type:"mint",info:{decimals:9}}}},{owner:ShahCat.TOKEN.programId,data:{parsed:{type:"mint",info:{decimals:6}}}}, {owner:ShahCat.TOKEN.programId,data:{parsed:{type:"mint",info:{isInitialized:false,decimals:9,supply:"1000000000000000000"}}}}]){
    await assert.rejects(auditAllocations({parkwon:A},fixture({getAccountInfo:{value}}).query),/Unexpected SHAH mint/);
  }
  const f=fixture({getAccountInfo:{value:{owner:ShahCat.TOKEN.programId,data:{parsed:{type:"mint",info:{isInitialized:true,decimals:9,supply:"999"}}}}}});
  const report=await auditAllocations({parkwon:A},f.query);assert.equal(report.supplyMatchesPolicy,false);
});
test("multiple accounts aggregate exact balances, frozen holdings and signed target difference",async()=>{
  const target=166666666000000000n;
  const {query,calls}=fixture({getTokenAccountsByOwner:([address,filter])=>{
    assert.deepEqual(filter,{mint:C});return {context:{slot:456},value:[account(address,target,A),account(address,1n,B,"frozen")]};
  }});
  const result=await auditAllocations({parkwon:B},query), member=result.members[2];
  assert.equal(member.heldRaw,String(target+1n));assert.equal(member.deltaRaw,"-1");assert.equal(member.frozenRaw,"1");
  assert.equal(member.relation,"above");assert.equal(member.slot,456);
  assert.equal(member.identityVerified,false);assert.equal(member.allocationVerified,false);assert.equal(member.lockVerified,false);
  assert.equal(result.signatureEnabled,false);assert.equal(result.broadcastingEnabled,false);
  assert.deepEqual(calls.map(x=>x[0]),["getGenesisHash","getAccountInfo","getTokenAccountsByOwner"]);
});
test("empty verified accounts are zero while RPC errors stay unknown and allow other rows to succeed",async()=>{
  const {query}=fixture({getTokenAccountsByOwner:([address])=>{if(address===A)throw Error("RPC unavailable");return {value:[]};}});
  const data=await auditAllocations({seongjae:A,dongwon:B},query);
  assert.equal(data.members[0].status,"error");assert.equal(data.members[0].heldRaw,null);
  assert.equal(data.members[1].status,"observed");assert.equal(data.members[1].heldRaw,"0");
});
test("wrong mint, owner, program, decimals, repeated token accounts and oversized holdings never become valid balances",async()=>{
  const valid=account(A,1n);
  const cases=[
    [{...valid,account:{...valid.account,owner:A}}],
    [account(B,1n)],
    [valid,valid],
    [account(A,1000000000000000001n)],
    [account(A,1n,A,"uninitialized")],
  ];
  for(const field of ["mint","tokenAmount"]){
    const a=account(A,1n);a.account.data.parsed.info[field]=field==="mint"?B:{amount:"1",decimals:6};cases.push([a]);
  }
  for(const value of cases){const data=await auditAllocations({seongjae:A},fixture({getTokenAccountsByOwner:{value}}).query);
    assert.equal(data.members[0].status,"error");assert.equal(data.members[0].heldRaw,null);}
});
async function request(url, method="GET") {
  let status,body;const f=fixture();
  await createRequestHandler(f.query)({url,method},{writeHead(s){status=s;},end(b){body=b;}});
  return {status,body,calls:f.calls};
}
test("allocation HTTP endpoint rejects writes, duplicate params and prototype-like keys",async t=>{
  t.mock.method(console,"error",()=>{});
  assert.equal((await request("/api/allocations","POST")).status,405);
  for(const url of ["/api/allocations?seongjae="+A+"&seongjae="+B,"/api/allocations?__proto__="+A]){
    const response=await request(url);assert.equal(response.status,400);assert.equal(response.calls.length,0);
  }
  const response=await request("/api/allocations");assert.equal(response.status,200);assert.equal(response.calls.length,0);
});
