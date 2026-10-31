import test from "node:test";
import assert from "node:assert/strict";
import {deliverTelegramRow} from "./telegram-delivery-adapter.mjs";
import {transferKey} from "./telegram-delivery-state.mjs";
const row={transaction_signature:"sig",sender_public_address:"from",recipient_public_address:"to",amount:"1",sender_role:"Treasury",recipient_role:"Test"};
function remote() {
  let state={},version=0;
  return {
    read:async()=>({commit:String(version),state:structuredClone(state)}),
    publish:async(snapshot,next)=>{
      if(snapshot.commit!==String(version))throw new Error("remote conflict");
      state=structuredClone(next);version++;
      return {commit:String(version),state:structuredClone(state)};
    },
    state:()=>state
  };
}
test("adapter formats message only after remote reservation",async()=>{
  const r=remote();
  let sent=0;
  const result=await deliverTelegramRow(row,{...r,chatId:"-1001",transport:async text=>{
    sent++;
    assert.match(text,/SHAH CAT Devnet/);
    assert.equal(r.state()[transferKey(row)].status,"reserved");
    return {ok:true,result:{message_id:123,chat:{id:-1001}}};
  }});
  assert.equal(result.status,"accepted");
  assert.equal(sent,1);
  assert.equal(r.state()[transferKey(row)].message_id,123);
});
test("adapter rejects mismatched Telegram receipt without retry",async()=>{
  const r=remote();
  const result=await deliverTelegramRow(row,{...r,chatId:"-1001",transport:async()=>({ok:true,result:{message_id:1,chat:{id:-1002}}})});
  assert.equal(result.status,"unknown");
  assert.equal(r.state()[transferKey(row)].status,"unknown");
});
test("adapter refuses to send without injected transport",async()=>{
  const r=remote();
  await assert.rejects(deliverTelegramRow(row,{...r,chatId:"-1001"}),/transport/);
  assert.deepEqual(r.state(),{});
});
