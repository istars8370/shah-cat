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
    assert.ok(out.payouts.every(x=>x.evidence.startsWith('[airdrop-template] Airdrop v0.1 approved application: ')));
    assert.ok(out.payouts.every(x=>!x.evidence.includes('undefined')));
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


test('rapid sequential submissions are sent to REVIEW',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-'));
  const path=join(dir,'events.jsonl');
  let tick=Date.parse('2026-10-29T00:00:00.000Z');
  const clock=()=>{const out=tick;tick+=500;return out;};
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock});
    await store.submit(app());
    const second=await store.submit(app({communityId:'member-b',wallet:walletB,evidenceUrl:'https://example.net/b'}));
    assert.equal(second.status,'REVIEW');
    assert.match(second.reason,/빠른 연속 신청/);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});


test('same Naver or Discord channel identity cannot be reused',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-channel-'));
  const path=join(dir,'events.jsonl');
  let store;
  let tick=Date.parse('2026-10-29T00:00:00.000Z');
  const clock=()=>{const out=tick;tick+=2000;return out;};
  try{
    store=await AirdropStore.open({path,startsAt,clock});
    const first=await store.submit(app({
      channel:'discord',
      channelUserId:'123456789012345678',
      evidenceUrl:'https://discord.com/channels/1/2/3',
      activities:['discordVerified']
    }));
    assert.equal(first.status,'PASS');

    const second=await store.submit(app({
      communityId:'member-b',
      wallet:walletB,
      channel:'discord',
      channelUserId:'123456789012345678',
      evidenceUrl:'https://discord.com/channels/1/2/4',
      activities:['discordVerified']
    }));
    assert.equal(second.status,'REJECT');
    assert.match(second.reason,/중복 채널 계정/);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});


test('Discord and Naver PASS applications remain payout HOLD until channel verified',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-gate-'));
  const path=join(dir,'events.jsonl');
  let store;
  let tick=Date.parse('2026-10-29T00:00:00.000Z');
  const clock=()=>{const out=tick;tick+=2000;return out;};
  try{
    store=await AirdropStore.open({path,startsAt,clock});
    const discord=await store.submit(app({
      channel:'discord',
      channelUserId:'123456789012345678',
      evidenceUrl:'https://discord.com/channels/1/2/3',
      activities:['discordVerified']
    }));
    assert.equal(discord.status,'PASS');
    assert.equal(store.propose().payouts.length,0);

    await store.verifyChannel({
      applicationId:discord.id,
      channel:'discord',
      channelUserId:'123456789012345678',
      source:'discord-interaction'
    });
    assert.equal(store.propose().payouts.length,1);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});

test('Devnet batch draft is deterministic and non-transactional',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-batch-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:now});
    await store.submit(app());
    const input={
      budgetId:'budget-genesis-2026-11',
      feeCapLamports:'5000',
      startsAt:'2026-11-01T00:00:00.000Z',
      expiresAt:'2026-11-30T23:59:59.000Z'
    };
    const a=store.devnetBatchDraft(input);
    const b=store.devnetBatchDraft(input);
    assert.equal(a.batchId,b.batchId);
    assert.equal(a.network,'devnet');
    assert.equal(a.requiresTreasuryApproval,true);
    assert.equal(a.transactionCreated,false);
    assert.equal(a.signed,false);
    assert.equal(a.broadcast,false);
    assert.equal(a.payoutCount,1);
    assert.equal(a.requests[0].budgetId,input.budgetId);
    assert.equal(a.requests[0].feeCapLamports,'5000');
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});

test('Devnet batch draft refuses missing Treasury budget id',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-batch-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:now});
    await store.submit(app());
    assert.throws(()=>store.devnetBatchDraft({
      startsAt:'2026-11-01T00:00:00.000Z',
      expiresAt:'2026-11-30T23:59:59.000Z'
    }),error=>error?.status===409);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});
