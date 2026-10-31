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
 assert.equal(l.events('account_test').filter(e=>e.type==='CONSUME').length,1);
});
test('real ledger: reserved refund paid credits are not spendable',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'PAID_DEMO',credits:10,grantId:'paid_ref',idempotencyKey:'key_paid_ref'});
 l.requestRefund({accountId:'account_test',credits:9,refundId:'refund_hold',idempotencyKey:'key_refund_hold'});
 const m=configured(l);
 assert.throws(()=>m.preview({accountId:'account_test',operationId:'job_ref',modelId:'demo-text',
  maxInputTokens:1000,maxOutputTokens:500}),{code:'INSUFFICIENT'});
 assert.equal(l.snapshot('account_test').paid_refund_reserved,9);
});
test('real ledger: preflight does not lock funds, so settlement fails closed if funds are spent',()=>{
 const l=setup();l.grant({accountId:'account_test',source:'BONUS',credits:20,grantId:'bonus_200',idempotencyKey:'key_bonus_200'});
 const m=configured(l);m.preview({accountId:'account_test',operationId:'job_200',modelId:'demo-text',maxInputTokens:1000,maxOutputTokens:500});
 l.consume({accountId:'account_test',credits:19,operationId:'other_job',idempotencyKey:'key_other_job'});
 assert.throws(()=>m.settle({accountId:'account_test',operationId:'job_200',usage:{inputTokens:1000,outputTokens:500,cachedInputTokens:0}}),{code:'INSUFFICIENT'});
 assert.equal(l.snapshot('account_test').total_available,1);
});
