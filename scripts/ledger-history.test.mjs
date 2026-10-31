import test from "node:test";
import assert from "node:assert/strict";
import {HEADERS, parseCsv, mergeRows, scanSignatures} from "./ledger-history.mjs";

const row=(sig,amount="1")=>Object.fromEntries(HEADERS.map(h=>[h,h==="transaction_signature"?sig:h==="amount"?amount:h==="timestamp_utc"?"2026-01-01T00:00:00Z":"x"]));
test("preserves historical rows and deduplicates repeats",()=>{
  const rows=mergeRows([row("old")],[row("old"),row("new")]);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.transaction_signature).sort(),["new","old"]);
});
test("rejects unexpected CSV schema",()=>assert.throws(()=>parseCsv("bad,header\n1,2\n"),/schema/));
test("paginates until checkpoint",async()=>{
  const calls=[];
  const rpc=async(_method,params)=>{
    calls.push(params[1].before);
    return params[1].before?[{signature:"checkpoint"}]:[{signature:"new2"},{signature:"new1"}];
  };
  assert.deepEqual(await scanSignatures("wallet","checkpoint",rpc,{pageSize:2,maxPages:3}),["new2","new1"]);
  assert.deepEqual(calls,[undefined,"new1"]);
});
test("fails closed on unbounded scan",async()=>{
  const rpc=async()=>[{signature:"new1"},{signature:"new2"}];
  await assert.rejects(scanSignatures("wallet","missing",rpc,{pageSize:2,maxPages:1}),/limit exceeded/);
});

test("fails closed when checkpoint disappears from RPC history",async()=>{
  const rpc=async()=>[{signature:"recent"}];
  await assert.rejects(scanSignatures("wallet","missing",rpc,{pageSize:2,maxPages:2}),/Checkpoint missing/);
});
