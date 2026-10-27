import test from 'node:test';import assert from 'node:assert/strict';
import {appendIntegrityRecord} from './integrity-ledger.mjs';import {verifyAuditBundle} from './integrity-verifier.mjs';
const r=appendIntegrityRecord([],{requestHash:'a'.repeat(64),decision:'offchain',policyVersion:1,algorithm:'ed25519'}).records;
const cp={count:1,headHash:r[0].recordHash};
test('accepts matching checkpoint',()=>assert.equal(verifyAuditBundle(r,cp).ok,true));
test('rejects wrong head',()=>assert.equal(verifyAuditBundle(r,{...cp,headHash:'0'.repeat(64)}).reason,'head-mismatch'));
test('rejects truncated history',()=>assert.equal(verifyAuditBundle([] ,cp).reason,'count-mismatch'));
test('rejects tampering',()=>assert.equal(verifyAuditBundle([{...r[0],decision:'forged'}],cp).reason,'broken-chain'));
