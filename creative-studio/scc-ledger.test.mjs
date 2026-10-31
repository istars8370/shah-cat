import test from 'node:test';
import assert from 'node:assert/strict';
import { createSccSandbox } from './scc-ledger.mjs';
const T=Date.parse('2026-10-31T00:00:00.000Z');
const a='demo_user';
const make=()=>createSccSandbox({now:()=>T});
const grant=(l,source,credits,id,extra={})=>l.grant({accountId:a,source,credits,grantId:id,idempotencyKey:'key_'+id,...extra});
const use=(l,credits,id)=>l.consume({accountId:a,credits,operationId:id,idempotencyKey:'key_'+id});
const T0=T;
const accountId=a;
const issued=(l,{source='BONUS',credits=100,grantId='grant_001',...rest}={})=>
  l.grant({accountId,source,credits,grantId,idempotencyKey:'key_'+grantId,...rest});
test('bonus and paid-demo balances are isolated',()=>{
 const l=make();grant(l,'BONUS',100,'bonus_1');grant(l,'PAID_DEMO',70,'paid_1');
 assert.equal(l.snapshot(a).total_available,170);
 assert.equal(l.snapshot(a).bonus_available,100);
 assert.equal(l.snapshot(a).paid_demo_available,70);
 assert.equal(l.snapshot('another_user').total_available,0);
 assert.equal(l.snapshot(a).sandbox,true);
 assert.equal('cashOut' in l,false);
});
test('bonus expires and spend takes earliest-expiring bonus first',()=>{
 const l=make();
 grant(l,'BONUS',50,'later',{expiresAt:'2026-12-31T00:00:00.000Z'});
 grant(l,'BONUS',40,'earlier',{expiresAt:'2026-11-30T00:00:00.000Z'});
 grant(l,'PAID_DEMO',40,'paid_lot');
 const r=use(l,110,'job_001');
 assert.deepEqual(r.event.allocations.map(x=>[x.grantId,x.credits]),
 [['earlier',40],['later',50],['paid_lot',20]]);
 assert.equal(l.snapshot(a).paid_demo_available,20);
 assert.throws(()=>use(l,21,'job_002'),{code:'INSUFFICIENT'});
});
test('expiry is applied to bonus but never to paid demo',()=>{
 let t=T; const l=createSccSandbox({now:()=>t});
 grant(l,'BONUS',50,'expiring',{expiresAt:'2026-11-01T00:00:00.000Z'});
 grant(l,'PAID_DEMO',70,'paid_noexpiry');
 t=Date.parse('2026-11-01T00:00:00.000Z');
 assert.equal(l.snapshot(a).bonus_expired,50);
 assert.equal(l.snapshot(a).total_available,70);
});
test('duplicate requests cannot double-issue or double-spend',()=>{
 const l=make();
 const request={accountId:a,source:'BONUS',credits:100,grantId:'same_grant',idempotencyKey:'key_one'};
 assert.deepEqual(l.grant(request),l.grant(request));
 assert.throws(()=>l.grant({...request,credits:200}),{code:'CONFLICT'});
 assert.throws(()=>l.grant({...request,idempotencyKey:'key_two'}),{code:'CONFLICT'});
 const purchase={accountId:a,credits:20,operationId:'same_use',idempotencyKey:'key_use'};
 assert.deepEqual(l.consume(purchase),l.consume(purchase));
 assert.equal(l.snapshot(a).bonus_available,80);
 assert.equal(l.events(a).length,2);
});
test('refund request reserves only unused simulated paid credit and can be cancelled',()=>{
 const l=make();grant(l,'BONUS',20,'bonus_ref');grant(l,'PAID_DEMO',100,'paid_ref');
 use(l,50,'job_ref');
 assert.throws(()=>l.requestRefund({accountId:a,credits:71,refundId:'too_much',idempotencyKey:'key_too_much'}),{code:'INSUFFICIENT'});
 const req={accountId:a,credits:60,refundId:'refund_01',idempotencyKey:'key_ref_01'};
 const r=l.requestRefund(req);
 assert.equal(r.event.status,'PENDING_MANUAL_REVIEW');
 assert.equal(r.event.cashRefunded,false);
 assert.deepEqual([l.snapshot(a).paid_demo_available,l.snapshot(a).paid_refund_reserved],[10,60]);
 assert.deepEqual(l.requestRefund(req),r);
 assert.throws(()=>l.requestRefund({...req,idempotencyKey:'key_ref_new'}),{code:'CONFLICT'});
 l.cancelRefund({accountId:a,refundId:'refund_01',idempotencyKey:'key_cancel'});
 assert.equal(l.snapshot(a).paid_demo_available,70);
 assert.equal(l.snapshot(a).paid_refund_reserved,0);
});
test('bonus refund and actual paid issuance are rejected',()=>{
 const l=make();grant(l,'BONUS',100,'bonus_only');
 assert.throws(()=>l.requestRefund({accountId:a,credits:1,refundId:'refund_bonus',idempotencyKey:'key_ref_bonus'}),{code:'INSUFFICIENT'});
 assert.throws(()=>grant(l,'PAID',100,'paid_live'),{code:'INVALID_INPUT'});
 assert.throws(()=>grant(l,'PAID_DEMO',100,'paid_exp',{expiresAt:'2026-12-01T00:00:00.000Z'}),{code:'INVALID_INPUT'});
});
test('invalid amounts, timestamps and IDs fail without creating events',()=>{
 const l=make();
 for(const credits of [0,-1,1.5,'1',Number.MAX_SAFE_INTEGER,NaN,Infinity]){
 assert.throws(()=>grant(l,'BONUS',credits,'invalid_amount'),{code:'INVALID_INPUT'});
 }
 for(const expiresAt of ['2026-10-30T00:00:00.000Z','2026-12-02','2026-02-30T00:00:00.000Z']){
 assert.throws(()=>grant(l,'BONUS',1,'invalid_time',{expiresAt}),{code:'INVALID_INPUT'});
 }
 assert.throws(()=>l.grant({accountId:'..',source:'BONUS',credits:1,grantId:'bad_id',idempotencyKey:'key_bad'}),{code:'INVALID_INPUT'});
 assert.equal(l.events(a).length,0);
});
test('returned objects cannot mutate stored balances',()=>{
 const l=make();const result=grant(l,'BONUS',100,'safe_copy');
 result.balance.bonus_available=10000;
 l.events(a)[0].credits=9999;
 assert.equal(l.snapshot(a).bonus_available,100);
 assert.equal(l.events(a)[0].credits,100);
});
test('account-scoped operations reject cross-account replay keys',()=>{
 const l=make();grant(l,'BONUS',100,'unique_lot');
 assert.throws(()=>l.grant({accountId:'other_user',source:'BONUS',credits:100,grantId:'unique_lot',idempotencyKey:'key_unique_lot'}),{code:'CONFLICT'});
 assert.equal(l.snapshot('other_user').total_available,0);
});

test('service reservation locks SCC and returns unused portion to exact original lots', () => {
  const l=createSccSandbox({now:()=>T0});
  issued(l,{source:'BONUS',credits:8,grantId:'bonus_lock',expiresAt:'2026-12-15T00:00:00.000Z'});
  issued(l,{source:'PAID_DEMO',credits:20,grantId:'paid_lock'});
  const hold={accountId,credits:15,reservationId:'job_hold',expiresAt:'2026-10-31T00:30:00.000Z',idempotencyKey:'key_hold'};
  const h=l.reserve(hold);
  assert.equal(h.event.type,'RESERVE');
  assert.deepEqual([h.balance.bonus_service_reserved,h.balance.paid_demo_service_reserved],[8,7]);
  assert.deepEqual(l.reserve(hold),h);
  assert.throws(()=>l.reserve({...hold,idempotencyKey:'key_new'}),{code:'CONFLICT'});
  const settle={accountId,reservationId:'job_hold',credits:10,idempotencyKey:'key_settle'};
  const result=l.settleReservation(settle);
  assert.equal(result.event.releasedCredits,5);
  assert.deepEqual(result.event.allocations.map(x=>[x.source,x.credits]),[['BONUS',8],['PAID_DEMO',2]]);
  assert.deepEqual([l.snapshot(accountId).bonus_available,l.snapshot(accountId).paid_demo_available],[0,18]);
  assert.equal(l.snapshot(accountId).total_service_reserved,0);
  assert.deepEqual(l.settleReservation(settle),result);
  assert.throws(()=>l.releaseReservation({accountId,reservationId:'job_hold',idempotencyKey:'key_after_settle'}),{code:'CONFLICT'});
});

test('service reservation rejection is atomic and does not reserve funds from another account', () => {
  const l=createSccSandbox({now:()=>T0});
  issued(l,{source:'PAID_DEMO',credits:10,grantId:'paid_avoid'});
  const base={accountId,reservationId:'hold_avoid',credits:15,expiresAt:'2026-10-31T00:05:00.000Z',idempotencyKey:'key_avoid'};
  assert.throws(()=>l.reserve(base),{code:'INSUFFICIENT'});
  assert.equal(l.snapshot(accountId).total_service_reserved,0);
  assert.equal(l.events(accountId).length,1);
  assert.throws(()=>l.reserve({...base,credits:5,expiresAt:'2026-10-30T00:00:00.000Z'}),{code:'INVALID_INPUT'});
  assert.throws(()=>l.reserve({...base,credits:5,expiresAt:'2026-10-31T02:00:00.000Z'}),{code:'INVALID_INPUT'});
  assert.throws(()=>l.reserve({...base,accountId:'other_account',credits:5}),{code:'INSUFFICIENT'});
  assert.equal(l.snapshot(accountId).total_available,10);
});

test('expired service reservation cannot settle; expiration release never revives expired bonus', () => {
  let now=T0;const l=createSccSandbox({now:()=>now});
  issued(l,{credits:10,grantId:'bonus_later',expiresAt:'2026-10-31T00:00:03.000Z'});
  const hold=l.reserve({accountId,reservationId:'hold_expiry',credits:5,
    expiresAt:'2026-10-31T00:00:02.000Z',idempotencyKey:'key_hold_expiry'});
  assert.equal(hold.balance.bonus_service_reserved,5);
  now=Date.parse('2026-10-31T00:00:04.000Z');
  assert.throws(()=>l.settleReservation({accountId,reservationId:'hold_expiry',credits:2,
    idempotencyKey:'key_late'}),{code:'EXPIRED'});
  const r=l.releaseReservation({accountId,reservationId:'hold_expiry',idempotencyKey:'key_release_expiry'});
  assert.equal(r.event.status,'EXPIRED');
  assert.equal(l.snapshot(accountId).bonus_available,0);
  assert.equal(l.snapshot(accountId).bonus_expired,10);
  assert.equal(l.snapshot(accountId).total_service_reserved,0);
});

test('simulated refund hold and service hold remain separate', () => {
  const l=createSccSandbox({now:()=>T0});
  issued(l,{source:'PAID_DEMO',credits:20,grantId:'paid_mixed'});
  l.requestRefund({accountId,refundId:'refund_mixed',credits:6,idempotencyKey:'key_refund_mixed'});
  const hold=l.reserve({accountId,reservationId:'service_mixed',credits:8,
    expiresAt:'2026-10-31T00:10:00.000Z',idempotencyKey:'key_service_mixed'});
  assert.deepEqual([hold.balance.paid_demo_available,hold.balance.paid_refund_reserved,
    hold.balance.paid_demo_service_reserved],[6,6,8]);
  l.releaseReservation({accountId,reservationId:'service_mixed',idempotencyKey:'key_service_release'});
  assert.deepEqual([l.snapshot(accountId).paid_demo_available,l.snapshot(accountId).paid_refund_reserved],[14,6]);
  l.cancelRefund({accountId,refundId:'refund_mixed',idempotencyKey:'key_refund_cancel_mixed'});
  assert.equal(l.snapshot(accountId).paid_demo_available,20);
});
