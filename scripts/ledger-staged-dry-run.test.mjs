import test from "node:test";
import assert from "node:assert/strict";
import {simulateDeliveryBatch} from "./ledger-staged-dry-run.mjs";
const row={transaction_signature:"sig",sender_public_address:"from",recipient_public_address:"to",amount:"1"};
test("offline stages reserve before send and acknowledge",async()=>{
 const result=await simulateDeliveryBatch([row]);
 assert.deepEqual(result.trace,["reserve","send","acknowledge"]);
 assert.equal(result.sends,1);
 assert.equal(Object.values(result.state)[0].status,"accepted");
});
test("failed reservation prevents send",async()=>{
 const result=await simulateDeliveryBatch([row],{failAt:"reserve"});
 assert.equal(result.sends,0);
 assert.equal(result.results[0].status,"blocked");
});
test("timeout records unknown without retry",async()=>{
 const result=await simulateDeliveryBatch([row,row],{failAt:"send"});
 assert.equal(result.sends,1);
 assert.equal(result.results[1].status,"already-recorded");
 assert.equal(Object.values(result.state)[0].status,"unknown");
});
test("failed acknowledgement leaves reserved for manual reconciliation",async()=>{
 const result=await simulateDeliveryBatch([row,row],{failAt:"acknowledge"});
 assert.equal(result.sends,1);
 assert.equal(result.results[0].status,"reconciliation-required");
 assert.equal(result.results[1].status,"already-recorded");
 assert.equal(Object.values(result.state)[0].status,"reserved");
});
