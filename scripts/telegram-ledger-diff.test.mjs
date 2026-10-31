import test from "node:test";
import assert from "node:assert/strict";
import {newTransfers} from "./notify-telegram-ledger.mjs";
import {HEADERS,mergeRows} from "./ledger-history.mjs";

function row(signature,amount) {
  return Object.fromEntries(HEADERS.map(field=>[field,field==="transaction_signature"?signature:field==="amount"?amount:field==="sender_public_address"?"sender":field==="recipient_public_address"?"recipient":"value"]));
}
function csv(rows) {
  return [HEADERS.join(","),...rows.map(row=>HEADERS.map(field=>row[field]).join(","))].join("\n")+"\n";
}
test("notifies second transfer in same signature",()=>{
  const previous=csv([row("sig","1")]);
  const current=csv([row("sig","1"),row("sig","2")]);
  assert.deepEqual(newTransfers(previous,current).map(x=>x.amount),["2"]);
});
test("deduplicates duplicate ledger rows",()=>{
  assert.equal(newTransfers(csv([]),csv([row("sig","1"),row("sig","1")])).length,1);
});
test("ledger merge and notification diff share identity semantics",()=>{
  const first=row("sig","1"),second=row("sig","2");
  assert.equal(mergeRows([first],[second]).length,2);
  assert.equal(newTransfers(csv([first]),csv([first,second])).length,1);
});
