import test from 'node:test';
import { sign } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { TreasuryStore, IDS, validateConfig } from './treasury-store.mjs';
import Policy from './tokenomics.js';
import { fixture, content, key } from './treasury-test-fixtures.mjs';
async function budget(w,extra={}) {const p=await w.store.create(content('budget',extra));for(const id of IDS)await w.vote(p,id);return p;}
test('config rejects missing, duplicate, wrong-chain and unknown signer fields',()=>{
 const signers=Object.fromEntries(IDS.map(id=>[id,key().address])),base={network:'devnet',mint:Policy.MINT,treasury:key().address,signers};
 assert.equal(validateConfig(base).network,'devnet');
 for(const bad of [{...base,network:'mainnet'},{...base,mint:key().address},{...base,secret:[]},{...base,signers:{...signers,dongwon:signers.seongjae}},{...base,signers:{...signers,other:key().address}},{...base,signers:{seongjae:signers.seongjae}}])assert.throws(()=>validateConfig(bad));
});
test('budget requires three independent valid Ed25519 approvals; no execution capability',async t=>{
 const w=await fixture(t),p=await w.store.create(content());
 assert.equal((await w.vote(p,IDS[0])).status,'pending');assert.equal((await w.vote(p,IDS[1])).status,'pending');
 const final=await w.vote(p,IDS[2]);assert.equal(final.status,'policy_approved');assert.equal(final.executionEnabled,false);assert.equal(final.onchainMultisigVerified,false);
 assert.throws(()=>w.vote(p,IDS[2]),/완료/);
});
test('forged signatures, signer swaps, decisions and other-ledger replay fail',async t=>{
 const w=await fixture(t),other=await fixture(t),p=await w.store.create(content());
 const message=w.store.message(p.id,1,IDS[0],'approve');
 const sig=sign(null,Buffer.from(message),w.pairs[IDS[0]].privateKey).toString('base64');
 for(const input of [{signer:IDS[1],decision:'approve',signature:sig},{signer:IDS[0],decision:'reject',signature:sig},{signer:IDS[0],decision:'approve',signature:'A'.repeat(86)+'=='},{signer:IDS[0],decision:'approve',signature:sig.slice(0,-1)}])await assert.rejects(w.store.decide({id:p.id,revision:1,...input}));
 const q=await other.store.create(content());await assert.rejects(other.vote(q,IDS[0],'approve',message));
 assert.equal(w.store.get(p.id).approvals.length,0);
});
test('revisions clear prior approvals; stale signatures and stale edit versions fail',async t=>{
 const w=await fixture(t),p=await w.store.create(content());const oldMessage=w.store.message(p.id,1,IDS[1],'approve');
 await w.vote(p,IDS[0]);const revised=await w.store.revise(p.id,1,content('budget',{purpose:'새 견적'}));
 assert.equal(revised.revision,2);assert.deepEqual(revised.approvals,[]);assert.notEqual(revised.nonce,p.nonce);
 await assert.rejects(w.vote(revised,IDS[1],'approve',oldMessage),/서명/);await assert.rejects(w.store.revise(p.id,1,content()),/버전/);
});
test('one signer cannot count twice; concurrent identical votes serialize',async t=>{
 const w=await fixture(t),p=await w.store.create(content());
 const votes=await Promise.allSettled([w.vote(p,IDS[0]),w.vote(p,IDS[0])]);assert.equal(votes.filter(x=>x.status==='fulfilled').length,1);assert.equal(w.store.get(p.id).approvals.length,1);
});
test('ordinary spending needs approved budget and two non-conflicted signers',async t=>{
 const w=await fixture(t);await assert.rejects(w.store.create(content('spend',{budgetId:'missing'})),/예산/);
 const b=await budget(w),p=await w.store.create(content('spend',{budgetId:b.id,recipient:w.config.signers.seongjae}));
 assert.deepEqual(p.content.conflicts,['seongjae']);assert.equal(p.required,2);
 assert.throws(()=>w.store.message(p.id,1,IDS[0],'approve'),/권한/);
 assert.equal((await w.vote(p,IDS[1])).status,'pending');assert.equal((await w.vote(p,IDS[2])).status,'policy_approved');
 await assert.rejects(w.store.revise(p.id,1,content('spend',{budgetId:b.id})),/승인 완료/);
});
test('multiple conflicts and conflicted exceptional spending cannot bypass quorum',async t=>{
 const w=await fixture(t),b=await budget(w);
 await assert.rejects(w.store.create(content('spend',{budgetId:b.id,conflicts:IDS.slice(0,2)})),/정족수/);
 for(const kind of ['exception','reserve']){
   await assert.rejects(w.store.create(content(kind,{conflicts:[IDS[0]]})),/정족수/);
   const p=await w.store.create(content(kind));await w.vote(p,IDS[0]);assert.equal((await w.vote(p,IDS[1])).status,'pending');assert.equal((await w.vote(p,IDS[2])).status,'policy_approved');
 }
});
test('cumulative token and fee limits prevent split-request overspend at concurrent approval',async t=>{
 const w=await fixture(t),b=await budget(w);
 const a=await w.store.create(content('spend',{budgetId:b.id,amountRaw:'600000000000',feeCapLamports:'6000000'}));
 const c=await w.store.create(content('spend',{budgetId:b.id,amountRaw:'600000000000',feeCapLamports:'6000000'}));
 await w.vote(a,IDS[0]);await w.vote(c,IDS[0]);
 const votes=await Promise.allSettled([w.vote(a,IDS[1]),w.vote(c,IDS[1])]);assert.equal(votes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(w.store.snapshot().requests.filter(x=>x.content.kind==='spend'&&x.status==='policy_approved').length,1);
 await assert.rejects(w.store.create(content('spend',{budgetId:b.id,amountRaw:'1',feeCapLamports:'4000001'})),/수수료/);
 const exact=await w.store.create(content('spend',{budgetId:b.id,amountRaw:'400000000000',feeCapLamports:'4000000'}));await w.vote(exact,IDS[0]);assert.equal((await w.vote(exact,IDS[1])).status,'policy_approved');
});
test('raw amounts preserve one base unit and dates, expiry, budget period fail closed',async t=>{
 const w=await fixture(t),b=await budget(w);
 const p=await w.store.create(content('spend',{budgetId:b.id,amountRaw:'1',feeCapLamports:'0'}));assert.equal(p.content.amountRaw,'1');
 for(const bad of [{amountRaw:'1e9'},{amountRaw:1},{amountRaw:'0'},{amountRaw:'18446744073709551616'},{feeCapLamports:'-1'},{startsAt:'2026-13-01T00:00:00.000Z'},{expiresAt:'2026-12-01T00:00:00.000Z'},{unknown:'x'}])await assert.rejects(w.store.create(content('spend',{budgetId:b.id,...bad})));
 w.setTime('2026-11-01T00:00:00Z');assert.equal(w.store.snapshot().requests.find(x=>x.id===p.id).status,'expired');assert.throws(()=>w.store.message(p.id,1,IDS[0],'approve'),/만료/);
});
test('expired approved reservations are retained conservatively',async t=>{
 const w=await fixture(t),b=await budget(w);
 const p=await w.store.create(content('spend',{budgetId:b.id,expiresAt:'2026-10-16T00:00:00.000Z'}));await w.vote(p,IDS[0]);await w.vote(p,IDS[1]);
 w.setTime('2026-10-17T00:00:00Z');await assert.rejects(w.store.create(content('spend',{budgetId:b.id,amountRaw:'1',feeCapLamports:'0'})),/누적/);
});
test('rejection is signed, retained and terminal',async t=>{
 const w=await fixture(t),p=await w.store.create(content());const final=await w.vote(p,IDS[1],'reject');assert.equal(final.status,'rejected');assert.ok(final.rejectedBy.signature);
 await assert.rejects(w.store.revise(p.id,1,content()),/반려/);assert.throws(()=>w.store.message(p.id,1,IDS[2],'approve'),/완료/);
});
test('journal survives restart, locks a second writer, and fails on corruption or config changes',async t=>{
 const w=await fixture(t),p=await w.store.create(content());await w.vote(p,IDS[0]);
 await assert.rejects(TreasuryStore.open({config:w.config,path:w.path}),{code:'EEXIST'});
 const initial=await readFile(w.path,'utf8');await w.store.close();
 const reloaded=await TreasuryStore.open({config:w.config,path:w.path,clock:()=>Date.parse('2026-10-15')});assert.deepEqual(reloaded.get(p.id),w.store.get(p.id));await reloaded.close();
 await assert.rejects(TreasuryStore.open({config:{...w.config,treasury:key().address},path:w.path}),/変更|변경/);
 await writeFile(w.path,initial.replace('개발 인프라','변조'));await assert.rejects(TreasuryStore.open({config:w.config,path:w.path}),/변경/);
 await writeFile(w.path,initial.slice(0,-1));await assert.rejects(TreasuryStore.open({config:w.config,path:w.path}),/손상/);
});
test('recomputed journal hash cannot turn a forged signature into a valid approval',async t=>{
 const w=await fixture(t),p=await w.store.create(content());await w.vote(p,IDS[0]);
 const events=(await readFile(w.path,'utf8')).trim().split('\n').map(x=>JSON.parse(x));
 const last=events.at(-1);last.proposal.approvals[0].signature='A'.repeat(86)+'==';
 const {digest,...body}=last;const {createHash}=await import('node:crypto');last.digest=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const forged=w.path+'.forged';await writeFile(forged,events.map(x=>JSON.stringify(x)).join('\n')+'\n');
 await assert.rejects(TreasuryStore.open({config:w.config,path:forged}),/서명/);
});
test('failed durable append stops all subsequent writes',async t=>{
 const w=await fixture(t),p=await w.store.create(content());const sync=w.store.handle.sync.bind(w.store.handle);w.store.handle.sync=async()=>{throw Error('disk unavailable');};
 await assert.rejects(w.vote(p,IDS[0]),/disk unavailable/);assert.equal(w.store.get(p.id).approvals.length,0);
 await assert.rejects(w.store.create(content()),/쓰기/);w.store.handle.sync=sync;
});

test('a custodian signer may share the Treasury address but still has only one approval vote',async t=>{
 const w=await fixture(t,{treasurySigner:'seongjae'}),p=await w.store.create(content());
 assert.equal(w.store.config.treasury,w.store.config.signers.seongjae);
 assert.deepEqual(w.store.snapshot().treasurySignerIds,['seongjae']);
 assert.equal((await w.vote(p,'seongjae')).status,'pending');
 assert.throws(()=>w.store.message(p.id,1,'treasury','approve'),/권한/);
 await assert.rejects(w.vote(p,'seongjae'),/이미 승인/);
 assert.equal((await w.vote(p,'dongwon')).status,'pending');
 assert.equal((await w.vote(p,'parkwon')).status,'policy_approved');
 assert.equal(w.store.snapshot().onchainMultisigVerified,false);
});


test('Airdrop Treasury batch creation is idempotent and stays pending',async t=>{
 const w=await fixture(t),b=await budget(w);
 const batchId='airdrop-0123456789abcdef';
 const requests=[
   content('spend',{budgetId:b.id,recipient:key().address,amountRaw:'1000000000',feeCapLamports:'5000',
     evidence:'[airdrop-batch:'+batchId+'] Airdrop v0.1 approved application: member-a'}),
   content('spend',{budgetId:b.id,recipient:key().address,amountRaw:'2000000000',feeCapLamports:'5000',
     evidence:'[airdrop-batch:'+batchId+'] Airdrop v0.1 approved application: member-b'})
 ];
 const first=await w.store.createBatch(batchId,requests);
 assert.equal(first.created,true);
 assert.equal(first.requests.length,2);
 assert.ok(first.requests.every(x=>x.status==='pending'));
 assert.ok(first.requests.every(x=>x.executionEnabled===false));
 const second=await w.store.createBatch(batchId,requests);
 assert.equal(second.created,false);
 assert.deepEqual(second.requests.map(x=>x.id).sort(),first.requests.map(x=>x.id).sort());
 assert.equal(w.store.snapshot().requests.filter(x=>x.content.evidence?.startsWith('[airdrop-batch:'+batchId+']')).length,2);
});

test('Airdrop Treasury batch ID cannot be replayed with changed content',async t=>{
 const w=await fixture(t),b=await budget(w),batchId='airdrop-fedcba9876543210';
 const request=content('spend',{budgetId:b.id,amountRaw:'1000000000',feeCapLamports:'5000',
   evidence:'[airdrop-batch:'+batchId+'] Airdrop v0.1 approved application: member-a'});
 await w.store.createBatch(batchId,[request]);
 await assert.rejects(w.store.createBatch(batchId,[{...request,amountRaw:'2000000000'}]),/내용 불일치/);
});
