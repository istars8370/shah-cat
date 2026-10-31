// Integration with the real SCC sandbox ledger; no network or payment operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSccSandbox } from './scc-ledger.mjs';
import { createSccMeter } from './scc-pricing.mjs';
const NOW=Date.parse('2026-10-31T00:00:00.000Z');
const rates={version:'integration-demo-v1',simulation:true,
  reviewedAt:'2026-10-01T00:00:00.000Z',expiresAt:'2026-12-01T00:00:00.000Z',source:'SYNTHETIC-INTEGRATION-ONLY',models:[{
  id:'demo-text',modality:'text',inputUsdMicrosPerMillion:1_000_000,
  cachedInputUsdMicrosPerMillion:200_000,outputUsdMicrosPerMillion:5_000_000,
  maxInputTokens:20_000,maxOutputTokens:4_000}]};
const configured=(ledger)=>createSccMeter({ledger,priceBook:rates,fxKrwPerUsdMilli:1_400_000,
  targetMarginBps:2000,krwPerScc:1,maxSccPerRequest:1000,now:()=>NOW});
const setup=()=>createSccSandbox({now:()=>NOW});
test('real ledger: bonus is consumed before paid-demo SCC and duplicates do not double charge',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'BONUS',credits:2,grantId:'bonus_100',idempotencyKey:'key_bonus_100'});
 l.grant({accountId:'account_test',source:'PAID_DEMO',credits:100,grantId:'paid_100',idempotencyKey:'key_paid_100'});
 const m=configured(l);const q=m.preview({accountId:'account_test',operationId:'job_100',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500});
 assert.ok(q.maxChargeScc>2);
 const data={accountId:'account_test',operationId:'job_100',usage:{inputTokens:1000,outputTokens:500,cachedInputTokens:0}};
 const result=m.settle(data);
 assert.equal(result.bonusDebitedScc,2);
 assert.equal(result.paidDemoDebitedScc,result.debitedScc-2);
 assert.equal(l.snapshot('account_test').total_available,102-result.debitedScc);
 assert.deepEqual(m.settle(data),result);
 assert.equal(l.events('account_test').filter(e=>e.type==='RESERVATION_SETTLED').length,1);
});
test('real ledger: reserved refund paid credits are not spendable',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'PAID_DEMO',credits:10,grantId:'paid_ref',idempotencyKey:'key_paid_ref'});
 l.requestRefund({accountId:'account_test',credits:9,refundId:'refund_hold',idempotencyKey:'key_refund_hold'});
 const m=configured(l);
 assert.throws(()=>m.preview({accountId:'account_test',operationId:'job_ref',modelId:'demo-text',
  maxInputTokens:1000,maxOutputTokens:500}),{code:'INSUFFICIENT'});
 assert.equal(l.snapshot('account_test').paid_refund_reserved,9);
});
test('real ledger: quoted SCC is reserved before another operation can spend',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'BONUS',credits:20,grantId:'bonus_200',idempotencyKey:'key_bonus_200'});
 const m=configured(l);
 const q=m.preview({accountId:'account_test',operationId:'job_200',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500});
 assert.equal(q.reservationCreated,true);
 assert.equal(l.snapshot('account_test').total_service_reserved,q.reservedScc);
 assert.equal(l.snapshot('account_test').total_available,20-q.reservedScc);
 assert.throws(()=>l.consume({accountId:'account_test',credits:19,operationId:'other_job',idempotencyKey:'key_other_job'}),{code:'INSUFFICIENT'});
 const actual=m.settle({accountId:'account_test',operationId:'job_200',usage:{inputTokens:600,outputTokens:300,cachedInputTokens:0}});
 assert.equal(actual.releasedScc,q.reservedScc-actual.debitedScc);
 assert.equal(l.snapshot('account_test').total_service_reserved,0);
 assert.equal(l.snapshot('account_test').total_available,20-actual.debitedScc);
});
test('real ledger: cancel and replay cannot double-release reserved SCC',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'PAID_DEMO',credits:20,grantId:'paid_cancel',idempotencyKey:'key_paid_cancel'});
 const m=configured(l);const q=m.preview({accountId:'account_test',operationId:'job_cancel',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500});
 assert.equal(l.snapshot('account_test').total_service_reserved,q.reservedScc);
 const result=m.cancel({accountId:'account_test',operationId:'job_cancel'});
 assert.equal(result.status,'RELEASED');assert.equal(result.releasedScc,q.reservedScc);
 assert.deepEqual(m.cancel({accountId:'account_test',operationId:'job_cancel'}),result);
 assert.equal(l.snapshot('account_test').paid_demo_available,20);
 assert.equal(l.snapshot('account_test').paid_demo_service_reserved,0);
 assert.throws(()=>m.settle({accountId:'account_test',operationId:'job_cancel',usage:{inputTokens:100,outputTokens:100,cachedInputTokens:0}}),{code:'CONFLICT'});
 assert.equal(l.events('account_test').filter(e=>e.type==='RESERVATION_RELEASED').length,1);
});
test('real ledger: expired hold must be released manually and cannot settle',()=>{
 let time=NOW;const l=createSccSandbox({now:()=>time});
 l.grant({accountId:'account_test',source:'BONUS',credits:15,grantId:'bonus_expire',idempotencyKey:'key_bonus_expire',expiresAt:'2026-12-01T00:00:00.000Z'});
 const m=createSccMeter({ledger:l,priceBook:rates,fxKrwPerUsdMilli:1_400_000,targetMarginBps:2000,
  krwPerScc:1,maxSccPerRequest:1000,now:()=>time,quoteTtlMs:1000});
 const q=m.preview({accountId:'account_test',operationId:'job_expiry',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500});
 time+=1000;
 assert.throws(()=>m.settle({accountId:'account_test',operationId:'job_expiry',usage:{inputTokens:100,outputTokens:100,cachedInputTokens:0}}),{code:'EXPIRED'});
 assert.equal(m.cancel({accountId:'account_test',operationId:'job_expiry'}).status,'EXPIRED');
 assert.equal(l.snapshot('account_test').total_service_reserved,0);
 assert.equal(l.snapshot('account_test').total_available,15);
});
test('real ledger: promotional credits expiring inside the reservation window are ineligible',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'BONUS',credits:15,grantId:'bonus_soon',idempotencyKey:'key_bonus_soon',expiresAt:'2026-10-31T00:00:05.000Z'});
 const m=createSccMeter({ledger:l,priceBook:rates,fxKrwPerUsdMilli:1_400_000,targetMarginBps:2000,
  krwPerScc:1,maxSccPerRequest:1000,now:()=>NOW,quoteTtlMs:10000});
 assert.throws(()=>m.preview({accountId:'account_test',operationId:'job_soon',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500}),{code:'INSUFFICIENT'});
 assert.equal(l.snapshot('account_test').bonus_available,15);
 assert.equal(l.snapshot('account_test').total_service_reserved,0);
});
test('real ledger: refunds cannot seize service-held credits',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'PAID_DEMO',credits:10,grantId:'paid_reserved',idempotencyKey:'key_paid_reserved'});
 const m=configured(l);const q=m.preview({accountId:'account_test',operationId:'job_refund_lock',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500});
 assert.throws(()=>l.requestRefund({accountId:'account_test',credits:10,refundId:'refund_steal',idempotencyKey:'key_refund_steal'}),{code:'INSUFFICIENT'});
 const refund=l.requestRefund({accountId:'account_test',credits:10-q.reservedScc,refundId:'refund_rest',idempotencyKey:'key_refund_rest'});
 assert.equal(refund.balance.paid_refund_reserved,10-q.reservedScc);
 assert.equal(refund.balance.paid_demo_service_reserved,q.reservedScc);
 assert.equal(refund.balance.paid_demo_available,0);
});
test('real ledger: account mismatch and conflicting settle replay are rejected',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'BONUS',credits:20,grantId:'bonus_isolated',idempotencyKey:'key_bonus_isolated'});
 const m=configured(l);const q=m.preview({accountId:'account_test',operationId:'job_isolated',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500});
 assert.throws(()=>m.settle({accountId:'other_account',operationId:'job_isolated',usage:{inputTokens:100,outputTokens:100,cachedInputTokens:0}}),{code:'NOT_FOUND'});
 const args={accountId:'account_test',operationId:'job_isolated',usage:{inputTokens:100,outputTokens:100,cachedInputTokens:0}};
 const settled=m.settle(args);assert.deepEqual(m.settle(args),settled);
 assert.throws(()=>m.settle({...args,usage:{...args.usage,inputTokens:101}}),{code:'CONFLICT'});
 assert.throws(()=>m.cancel({accountId:'account_test',operationId:'job_isolated'}),{code:'CONFLICT'});
 assert.equal(l.events('account_test').filter(e=>e.type==='RESERVATION_SETTLED').length,1);
});
