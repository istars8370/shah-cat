import test from 'node:test';import assert from 'node:assert/strict';import {inspectDevnet} from './devnet-readonly.mjs';
const calls=[];
const fake=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p.method);return {ok:true,json:async()=>({jsonrpc:'2.0',id:p.id,result:p.method==='getGenesisHash'?'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG':p.method==='getSlot'?123:{'solana-core':'test'}})};};
test('queries read-only RPC methods only',async()=>{calls.length=0;const r=await inspectDevnet(fake);assert.equal(r.readOnly,true);assert.equal(r.transfersEnabled,false);assert.equal(r.commitment,'finalized');assert.deepEqual(calls,['getGenesisHash','getSlot','getVersion','getGenesisHash']);});
test('rejects other RPC URLs',async()=>await assert.rejects(()=>inspectDevnet(fake,'https://api.mainnet-beta.solana.com'),/devnet-only/));
test('rejects RPC error',async()=>await assert.rejects(()=>inspectDevnet(async()=>({ok:true,json:async()=>({error:{code:-1}})})),/rpc-response-error/));
