import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAirdropAdmin } from './airdrop-auth.mjs';

function req(value){return {headers:{authorization:value}};}

test('airdrop admin auth rejects missing or wrong bearer token',()=>{
  const prior=process.env.AIRDROP_ADMIN_TOKEN;
  process.env.AIRDROP_ADMIN_TOKEN='abcdefghijklmnopqrstuvwxyz123456';
  try{
    assert.throws(()=>requireAirdropAdmin(req('')),e=>e?.status===403);
    assert.throws(()=>requireAirdropAdmin(req('Bearer wrongwrongwrongwrongwrongwrong')),e=>e?.status===403);
    assert.doesNotThrow(()=>requireAirdropAdmin(req('Bearer abcdefghijklmnopqrstuvwxyz123456')));
  }finally{
    if(prior===undefined) delete process.env.AIRDROP_ADMIN_TOKEN; else process.env.AIRDROP_ADMIN_TOKEN=prior;
  }
});

test('airdrop admin auth requires a sufficiently long configured secret',()=>{
  const prior=process.env.AIRDROP_ADMIN_TOKEN;
  process.env.AIRDROP_ADMIN_TOKEN='short';
  try{assert.throws(()=>requireAirdropAdmin(req('Bearer short')),e=>e?.status===503);}
  finally{if(prior===undefined) delete process.env.AIRDROP_ADMIN_TOKEN; else process.env.AIRDROP_ADMIN_TOKEN=prior;}
});
