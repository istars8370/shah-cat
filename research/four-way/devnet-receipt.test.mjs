import test from 'node:test';import assert from 'node:assert/strict';import {verifyDevnetReceipt} from './devnet-receipt.mjs';
const sig='1'.repeat(88);
const mock=(status,tx)=>async(_url,opts)=>({ok:true,json:async()=>({result:JSON.parse(opts.body).method==='getSignatureStatuses'?{value:[status]}:tx})});
test('finalized successful receipt accepted',async()=>{const r=await verifyDevnetReceipt(sig,{fetchImpl:mock({err:null,confirmationStatus:'finalized'},{slot:42,meta:{err:null,fee:5000}})});assert.equal(r.verified,true);assert.equal(r.slot,42);});
test('failed transaction rejected',async()=>assert.equal((await verifyDevnetReceipt(sig,{fetchImpl:mock({err:{InstructionError:[0,'Custom']},confirmationStatus:'finalized'},null)})).verified,false));
test('unfinalized transaction rejected',async()=>assert.equal((await verifyDevnetReceipt(sig,{fetchImpl:mock({err:null,confirmationStatus:'confirmed'},null)})).reason,'not-finalized'));
test('unknown transaction rejected',async()=>assert.equal((await verifyDevnetReceipt(sig,{fetchImpl:mock(null,null)})).reason,'not-found'));
test('rejects malformed signature',async()=>await assert.rejects(()=>verifyDevnetReceipt('abc'),/invalid-signature-format/));
test('rejects mainnet RPC',async()=>await assert.rejects(()=>verifyDevnetReceipt(sig,{rpcUrl:'https://api.mainnet-beta.solana.com'}),/devnet-only/));
