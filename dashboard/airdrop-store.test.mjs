import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AirdropStore } from './airdrop-store.mjs';

const walletA='3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs';
const walletB='9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9';
const startsAt='2026-10-28T00:00:00.000Z';
const now=()=>Date.parse('2026-10-29T00:00:00.000Z');

function app(overrides={}){
  return {communityId:'member-a',wallet:walletA,evidenceUrl:'https://example.com/a',
    submittedAt:'2026-10-28T01:00:00.000Z',activities:['join','externalPromotion'],flags:[],...overrides};
}

test('append-only store survives reopen and blocks persisted duplicate wallet',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:now});
    const first=await store.submit(app());
    assert.equal(first.status,'PASS');
    await store.close();store=null;

    store=await AirdropStore.open({path,startsAt,clock:now});
    assert.equal(store.snapshot().total,1);
    const duplicate=await store.submit(app({communityId:'member-b',evidenceUrl:'https://example.com/b'}));
    assert.equal(duplicate.status,'REJECT');
    assert.match(duplicate.reason,/기존 원장 중복 지갑/);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});

test('proposal remains non-transactional and Treasury export is a template',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:now});
    await store.submit(app());
    await store.submit(app({communityId:'member-b',wallet:walletB,evidenceUrl:'https://example.com/b',activities:['video','testReport']}));
    const plan=store.propose();
    assert.equal(plan.requiresHumanApproval,true);
    assert.equal(plan.transactionCreated,false);
    assert.ok(BigInt(plan.totalRaw)>0n);
    const out=store.treasuryExport();
    assert.equal(out.automaticExecution,false);
    assert.ok(out.payouts.length>0);
    assert.ok(out.payouts.every(x=>x.budgetId===null));
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});


test('REVIEW decision is append-only and survives reopen',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:now});
    const reviewItem=await store.submit(app({flags:['github-contribution'],activities:['github:20']}));
    assert.equal(reviewItem.status,'REVIEW');
    const approved=await store.review({id:reviewItem.id,decision:'approve',note:'기여 내용 수동 확인'});
    assert.equal(approved.status,'PASS');
    assert.equal(approved.reviewNote,'기여 내용 수동 확인');
    await store.close();store=null;

    store=await AirdropStore.open({path,startsAt,clock:now});
    const saved=store.snapshot().applications.find(x=>x.id===reviewItem.id);
    assert.equal(saved.status,'PASS');
    assert.equal(saved.reviewNote,'기여 내용 수동 확인');
    assert.ok(store.snapshot().events.some(x=>x.type==='review-approve'));
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});

test('only REVIEW applications can be manually decided',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:now});
    const passed=await store.submit(app());
    await assert.rejects(
      store.review({id:passed.id,decision:'reject',note:'should not be allowed'}),
      error=>error?.status===409
    );
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});
