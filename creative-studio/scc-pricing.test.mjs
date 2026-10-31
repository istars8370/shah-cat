import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePriceBook, calculateSccCost, createSccMeter } from './scc-pricing.mjs';

const START = Date.parse('2026-10-31T00:00:00.000Z');
const book = () => ({ version: 'demo-v1', simulation: true,
  reviewedAt: '2026-10-01T00:00:00.000Z', expiresAt: '2026-12-01T00:00:00.000Z',
  source: 'SYNTHETIC-RATES-NOT-PROVIDER-PRICING', models: [
    { id: 'demo-basic', modality: 'text', inputUsdMicrosPerMillion: 1_000_000,
      cachedInputUsdMicrosPerMillion: 250_000, outputUsdMicrosPerMillion: 4_000_000,
      maxInputTokens: 100_000, maxOutputTokens: 20_000 },
    { id: 'demo-plus', modality: 'text', inputUsdMicrosPerMillion: 2_000_000,
      cachedInputUsdMicrosPerMillion: 500_000, outputUsdMicrosPerMillion: 12_000_000,
      maxInputTokens: 100_000, maxOutputTokens: 20_000 },
  ] });
const price = (params={}) => calculateSccCost({ book: validatePriceBook(book()), modelId: 'demo-basic',
  usage: { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 100 },
  fxKrwPerUsdMilli: 1_400_000, targetMarginBps: 2000, krwPerScc: 1, ...params });
function ledger(balance=100) {
  let n=balance;
  const debits=new Map();
  return { snapshot:()=>({total_available:n}), consume(request) {
    const existing=debits.get(request.idempotencyKey);
    if (existing) return structuredClone(existing);
    if(request.credits>n) {const e=new Error('insufficient');e.code='INSUFFICIENT'; throw e;}
    n-=request.credits;
    const result={event:{allocations:[{source:'BONUS',credits:request.credits}]},balance:{total_available:n}};
    debits.set(request.idempotencyKey,result); return structuredClone(result);
  }, debitCount:()=>debits.size };
}
const meter = (opts={}) => createSccMeter({ ledger: ledger(), priceBook: book(),
  fxKrwPerUsdMilli: 1_400_000, targetMarginBps: 2000, krwPerScc: 1,
  maxSccPerRequest: 500, now: ()=>START, ...opts });
const request={accountId:'test_account',operationId:'request_001',modelId:'demo-basic',
  maxInputTokens:1000,maxOutputTokens:500};

// Whole-number calculation: 900 * $1/1M + 100 * $0.25/1M + 500 * $4/1M
// = $0.002925 = 2925 microUSD; illustrative KRW/USD=1400, provider cost 5 KRW.
test('token pricing is exact with cache and KRW rounding', () => {
  const r=price();
  assert.equal(r.providerUsdMicros,2925);
  assert.equal(r.providerKrw,5);
  assert.equal(r.billableKrw,7);
  assert.equal(r.chargeScc,7);
  assert.equal(r.simulated,true);
});
test('model selection is explicit and never guesses unknown prices',()=>{
  const low=price();
  const high=price({modelId:'demo-plus'});
  assert.ok(high.chargeScc>low.chargeScc);
  assert.throws(()=>price({modelId:'unregistered'}),{code:'UNSUPPORTED'});
});
test('no negative/fractional/missing/overlimit token consumption',()=>{
  for(const n of [-1, 0.2, '20', Number.MAX_SAFE_INTEGER]){
    assert.throws(()=>price({usage:{inputTokens:n,outputTokens:1,cachedInputTokens:0}}),{code:'INVALID_INPUT'});
  }
  assert.throws(()=>price({usage:{inputTokens:10,outputTokens:2,cachedInputTokens:11}}),{code:'INVALID_INPUT'});
  assert.throws(()=>price({usage:{inputTokens:0,outputTokens:0,cachedInputTokens:0}}),{code:'INVALID_INPUT'});
});
test('no silent modality, duplicate SKU or missing price acceptance',()=>{
  assert.throws(()=>validatePriceBook({...book(),models:[{...book().models[0],modality:'video'}]}),{code:'UNSUPPORTED'});
  assert.throws(()=>validatePriceBook({...book(),models:[book().models[0],book().models[0]]}),{code:'INVALID_PRICE_BOOK'});
  assert.throws(()=>validatePriceBook({...book(),simulation:false}),{code:'INVALID_PRICE_BOOK'});
  assert.throws(()=>validatePriceBook({...book(),models:[{...book().models[0],outputUsdMicrosPerMillion:-1}]}),{code:'INVALID_INPUT'});
});
test('cost is integer-bounded with no floating point charge',()=>{
  const output=price({usage:{inputTokens:1,outputTokens:0,cachedInputTokens:0},krwPerScc:10});
  assert.equal(output.chargeScc,1);
  assert.ok(Number.isSafeInteger(output.providerUsdMicros));
  assert.ok(Number.isSafeInteger(output.providerKrw));
});
test('preview estimates full uncached worst-case without debiting',()=>{
  const l=ledger();const m=meter({ledger:l});
  const q=m.preview(request);
  assert.equal(q.reservationCreated,false);
  assert.ok(q.maxChargeScc>=price({usage:{inputTokens:1000,outputTokens:500,cachedInputTokens:0}}).chargeScc);
  assert.equal(q.availableAtPreview,100);
  assert.equal(l.debitCount(),0);
  assert.deepEqual(m.preview(request),q);
});
test('preview rejects insufficient balance, per-request caps, stale and changed IDs',()=>{
  assert.throws(()=>meter({ledger:ledger(1)}).preview(request),{code:'INSUFFICIENT'});
  assert.throws(()=>meter({maxSccPerRequest:2}).preview(request),{code:'BUDGET'});
  assert.throws(()=>meter({now:()=>Date.parse('2027-01-01T00:00:00.000Z')}).preview(request),{code:'STALE_PRICE'});
  const m=meter();m.preview(request);
  assert.throws(()=>m.preview({...request,maxOutputTokens:700}),{code:'CONFLICT'});
});
test('settlement uses measured usage rather than preflight maximum',()=>{
  const l=ledger();const m=meter({ledger:l});const q=m.preview(request);
  const usage={inputTokens:600,outputTokens:300,cachedInputTokens:0};
  const s=m.settle({accountId:request.accountId,operationId:q.operationId,usage});
  assert.ok(s.debitedScc<q.maxChargeScc);
  assert.equal(s.debitedScc,s.bonusDebitedScc);
  assert.equal(s.paidDemoDebitedScc,0);
  assert.equal(l.debitCount(),1);
  assert.equal(s.paidCashVerified,false);
});
test('settlement is idempotent and rejects conflicting usage',()=>{
  const l=ledger();const m=meter({ledger:l});m.preview(request);
  const args={accountId:request.accountId,operationId:request.operationId,usage:{inputTokens:600,outputTokens:300,cachedInputTokens:0}};
  assert.deepEqual(m.settle(args),m.settle(args));
  assert.equal(l.debitCount(),1);
  assert.throws(()=>m.settle({...args,usage:{...args.usage,outputTokens:301}}),{code:'CONFLICT'});
});
test('settlement rejects quote overrun and timeout before credit debit',()=>{
  const l=ledger();const m=meter({ledger:l});m.preview(request);
  assert.throws(()=>m.settle({accountId:request.accountId,operationId:request.operationId,
    usage:{inputTokens:9999,outputTokens:300,cachedInputTokens:0}}),{code:'BUDGET'});
  assert.equal(l.debitCount(),0);
  let t=START;const exp=meter({ledger:l,now:()=>t,quoteTtlMs:1000});
  exp.preview({...request,operationId:'request_exp'});t+=1000;
  assert.throws(()=>exp.settle({accountId:request.accountId,operationId:'request_exp',
    usage:{inputTokens:200,outputTokens:100,cachedInputTokens:0}}),{code:'EXPIRED'});
});
test('pricebook inputs are snapshot copied and do not update after quote',()=>{
  const catalog=book();const m=meter({priceBook:catalog});
  const q=m.preview(request);
  catalog.models[0].outputUsdMicrosPerMillion=900_000_000;
  const s=m.settle({accountId:request.accountId,operationId:request.operationId,
    usage:{inputTokens:600,outputTokens:300,cachedInputTokens:0}});
  assert.ok(s.debitedScc<q.maxChargeScc);
});
test('quotes are not transferable between account IDs',()=>{
  const m=meter();m.preview(request);
  assert.throws(()=>m.settle({accountId:'another_account',operationId:request.operationId,
    usage:{inputTokens:1,outputTokens:1,cachedInputTokens:0}}),{code:'NOT_FOUND'});
});
