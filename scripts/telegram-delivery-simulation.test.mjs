import test from "node:test";
import assert from "node:assert/strict";
import {MockDeliveryBranch,reserveAndConfirm,acknowledge,recoveryCandidates} from "./telegram-delivery-simulation.mjs";
import {transferKey} from "./telegram-delivery-state.mjs";
const row={transaction_signature:"sig",sender_public_address:"from",recipient_public_address:"to",amount:"1"};
test("remote reservation is committed before any send eligibility",()=>{
  const branch=new MockDeliveryBranch();
  const reserved=reserveAndConfirm(branch,[row]);
  assert.equal(reserved.rows.length,1);
  assert.equal(branch.read().state[transferKey(row)].status,"reserved");
  assert.equal(reserveAndConfirm(branch,[row]).rows.length,0);
});
test("remote compare-and-swap rejects concurrent writers",()=>{
  const branch=new MockDeliveryBranch();
  const original=branch.read();
  branch.compareAndSwap(original.version,{external:{status:"unknown"}});
  assert.throws(()=>branch.compareAndSwap(original.version,{}),/conflict/);
});
test("crash after reservation requires manual reconciliation",()=>{
  const branch=new MockDeliveryBranch();
  reserveAndConfirm(branch,[row]);
  assert.equal(recoveryCandidates(branch).length,1);
  assert.equal(reserveAndConfirm(branch,[row]).rows.length,0);
});
test("accepted acknowledgement is durable in simulated remote state",()=>{
  const branch=new MockDeliveryBranch();
  const reservation=reserveAndConfirm(branch,[row]);
  acknowledge(branch,reservation.snapshot,row,{status:"accepted",message_id:12,chat_id:"-1001"});
  assert.equal(branch.read().state[transferKey(row)].status,"accepted");
  assert.equal(recoveryCandidates(branch).length,0);
});
test("acknowledgement fails when remote state changed concurrently",()=>{
  const branch=new MockDeliveryBranch();
  const reservation=reserveAndConfirm(branch,[row]);
  branch.compareAndSwap(reservation.snapshot.version,{...branch.read().state,other:{status:"unknown"}});
  assert.throws(()=>acknowledge(branch,reservation.snapshot,row,{status:"unknown"}),/conflict/);
});

test("missing remote reservation never authorizes send",()=>{
  const branch=new MockDeliveryBranch();
  const original=branch.read();
  assert.equal(original.state[transferKey(row)],undefined);
  assert.equal(reserveAndConfirm(branch,[]).rows.length,0);
});
test("unconfirmed conflict never publishes local reservation",()=>{
  const branch=new MockDeliveryBranch();
  const old=branch.read();
  branch.compareAndSwap(old.version,{external:{status:"unknown"}});
  assert.throws(()=>branch.compareAndSwap(old.version,{[transferKey(row)]:{status:"reserved"}}),/conflict/);
  assert.equal(branch.read().state[transferKey(row)],undefined);
});
test("unknown delivery remains blocked after simulated restart",()=>{
  const branch=new MockDeliveryBranch();
  const reservation=reserveAndConfirm(branch,[row]);
  acknowledge(branch,reservation.snapshot,row,{status:"unknown"});
  assert.equal(reserveAndConfirm(branch,[row]).rows.length,0);
  assert.equal(recoveryCandidates(branch)[0].status,"unknown");
});
