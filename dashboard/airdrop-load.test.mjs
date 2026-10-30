import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AirdropStore } from './airdrop-store.mjs';

const startsAt='2026-10-28T00:00:00.000Z';
function clockFactory(){
  let n=0;
  const base=Date.parse('2026-10-29T00:00:00.000Z');
  return ()=>base+(n++)*2000;
}
function wallet(i){
  const base='11111111111111111111111111111111';
  if(i===0)return base;
  // Use known valid public keys alternately for focused policy tests elsewhere.
  return i%2===0?'3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs':'9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9';
}

test('daily intake cap sends overflow to REVIEW instead of uncontrolled PASS',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-load-'));
  const path=join(dir,'events.jsonl');
  const now=clockFactory();
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:now});
    // Directly seed 150 distinct accepted ledger records to isolate cap behavior
    // without manufacturing hundreds of Solana keys in the test.
    for(let i=0;i<150;i++){
      const application={id:'seed-'+i,createdAt:new Date(Date.parse('2026-10-29T00:00:00.000Z')+i*2000).toISOString(),
        status:'PASS',reason:'seed',score:1,communityId:'seed-'+i,wallet:'seed-wallet-'+i,evidenceUrl:'https://seed'+i+'.example/a',activities:['join'],flags:[],proposedRaw:'0'};
      await store.append('test-seed',application);
    }
    const out=await store.submit({communityId:'overflow',wallet:'3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs',
      evidenceUrl:'https://overflow.example/a',submittedAt:'2026-10-29T00:10:00.000Z',activities:['join'],flags:[]});
    assert.equal(out.status,'REVIEW');
    assert.match(out.reason,/일일 신청 상한/);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});

test('hard cap prevents the 2001st application from passing',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-airdrop-hardcap-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:()=>Date.parse('2026-10-30T00:00:00.000Z')});
    for(let i=0;i<2000;i++){
      const application={id:'seed-'+i,createdAt:'2026-10-29T00:00:00.000Z',status:'PASS',reason:'seed',score:1,
        communityId:'seed-'+i,wallet:'seed-wallet-'+i,evidenceUrl:null,activities:['join'],flags:[],proposedRaw:'0'};
      await store.append('test-seed',application);
    }
    const out=await store.submit({communityId:'hardcap',wallet:'3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs',
      evidenceUrl:'https://hardcap.example/a',submittedAt:'2026-10-30T00:00:00.000Z',activities:['join'],flags:[]});
    assert.equal(out.status,'REJECT');
    assert.match(out.reason,/Hard Cap/);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});
