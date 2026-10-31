import test from "node:test";
import assert from "node:assert/strict";
import {assertStateKeysCompatible} from "./telegram-state-compatibility.mjs";
import {transferKey} from "./telegram-delivery-state.mjs";

const row={transaction_signature:"sig",sender_public_address:"from",recipient_public_address:"to",amount:"1"};
test("accepts canonical serialized tuple",()=>{
  assert.equal(assertStateKeysCompatible({[transferKey(row)]:{status:"reserved"}}),true);
});
test("rejects legacy pipe-separated keys",()=>{
  assert.throws(()=>assertStateKeysCompatible({"sig|from|to|1":{status:"reserved"}}),/manual migration/);
});
test("rejects malformed or ambiguous key structures",()=>{
  for(const key of ["external",'["sig","from"]','["sig","from","to",1]','["","from","to","1"]']) {
    assert.throws(()=>assertStateKeysCompatible({[key]:{status:"unknown"}}),/manual migration/);
  }
});
