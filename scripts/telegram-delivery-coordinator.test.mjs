import test from "node:test";
import assert from "node:assert/strict";
import {deliverReservedTransfer} from "./telegram-delivery-coordinator.mjs";
import {transferKey} from "./telegram-delivery-state.mjs";

const row={transaction_signature:"sig",sender_public_address:"from",recipient_public_address:"to",amount:"1"};
function mockRemote(initial={}) {
  let state=structuredClone(initial),version=0;
  return {
    read:async()=>({commit:String(version),state:structuredClone(state)}),
    publish:async(snapshot,next)=>{
      if(snapshot.commit!==String(version)) throw new Error("conflict");
      state=structuredClone(next);version++;
      return {commit:String(version),state:structuredClone(state)};
    },
    get:()=>structuredClone(state)
  };
}
test("remote reservation exists before send is called",async()=>{
  const remote=mockRemote();
  const result=await deliverReservedTransfer(row,{...remote,send:async()=>{
    assert.equal(remote.get()[transferKey(row)].status,"reserved");
    return {status:"accepted",message_id:5,chat_id:"-1001"};
  }});
  assert.equal(result.status,"accepted");
  assert.equal(remote.get()[transferKey(row)].status,"accepted");
});
test("reservation publish failure blocks send",async()=>{
  let sent=false;
  await assert.rejects(deliverReservedTransfer(row,{
    read:async()=>({commit:"0",state:{}}),
    publish:async()=>{throw new Error("push rejected");},
    send:async()=>{sent=true;}
  }),/push rejected/);
  assert.equal(sent,false);
});
test("uncertain send outcome is never retried automatically",async()=>{
  const remote=mockRemote();
  const result=await deliverReservedTransfer(row,{...remote,send:async()=>{throw new Error("timeout");}});
  assert.equal(result.status,"unknown");
  let sent=false;
  const retry=await deliverReservedTransfer(row,{...remote,send:async()=>{sent=true;}});
  assert.equal(retry.status,"already-recorded");
  assert.equal(sent,false);
});
test("acknowledgement publication failure leaves reserved state",async()=>{
  const remote=mockRemote();
  let calls=0;
  const result=await deliverReservedTransfer(row,{
    read:remote.read,
    publish:async(...args)=>{calls++;if(calls===2)throw new Error("publish failure");return remote.publish(...args);},
    send:async()=>({status:"accepted",message_id:8,chat_id:"-1001"})
  });
  assert.equal(result.status,"reconciliation-required");
  assert.equal(remote.get()[transferKey(row)].status,"reserved");
});
