import test from "node:test";
import assert from "node:assert/strict";
import {transferKey,pendingTransfers,acceptedReceipt,recordDelivery,parseDeliveryState,reserveTransfers,resolveReservation} from "./telegram-delivery-state.mjs";

const row={transaction_signature:"sig",sender_public_address:"from",recipient_public_address:"to",amount:"2"};
test("deduplicates by full transfer identity, not signature alone",()=>{
  const second={...row,amount:"3"};
  assert.equal(pendingTransfers([row,row,second],{}).length,2);
});
test("accepted deliveries are not resent",()=>{
  const state=recordDelivery({},row,acceptedReceipt({ok:true,result:{message_id:42,chat:{id:-1001}}},"-1001"));
  assert.equal(pendingTransfers([row],state).length,0);
});
test("unknown outcomes require manual review, not automatic retry",()=>{
  const state=recordDelivery({},row,{status:"unknown"});
  assert.equal(pendingTransfers([row],state).length,0);
});
test("rejects invalid or mismatched Telegram receipts",()=>{
  assert.throws(()=>acceptedReceipt({ok:true,result:{chat:{id:-1001}}},"-1001"),/invalid/);
  assert.throws(()=>acceptedReceipt({ok:true,result:{message_id:42,chat:{id:-1002}}},"-1001"),/mismatch/);
});
test("rejects duplicate delivery state transitions",()=>{
  const state=recordDelivery({},row,{status:"unknown"});
  assert.throws(()=>recordDelivery(state,row,{status:"accepted",message_id:42,chat_id:"-1001"}),/already recorded/);
});
test("rejects invalid persisted delivery state",()=>{
  assert.throws(()=>parseDeliveryState('{"bad":{"status":"sent"}}'),/Invalid delivery record/);
});

test("reserves before sending and does not retry after crash",()=>{
  const prepared=reserveTransfers([row,row],{});
  assert.equal(prepared.rows.length,1);
  assert.equal(prepared.state[transferKey(row)].status,"reserved");
  assert.equal(reserveTransfers([row],parseDeliveryState(JSON.stringify(prepared.state))).rows.length,0);
});
test("requires reservation for delivery acknowledgement",()=>{
  assert.throws(()=>resolveReservation({},row,{status:"unknown"}),/No active/);
  const reserved=reserveTransfers([row],{}).state;
  const accepted=resolveReservation(reserved,row,{status:"accepted",message_id:12,chat_id:"-1001"});
  assert.equal(accepted[transferKey(row)].status,"accepted");
});
