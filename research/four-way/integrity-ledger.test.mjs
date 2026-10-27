import test from 'node:test';import assert from 'node:assert/strict';
import {appendIntegrityRecord,verifyIntegrityRecords} from './integrity-ledger.mjs';
const e={requestHash:'a'.repeat(64),decision:'offchain-verified',policyVersion:1,algorithm:'ed25519'};
test('creates verifiable audit chain',()=>{const a=appendIntegrityRecord([],e);const b=appendIntegrityRecord(a.records,{...e,requestHash:'b'.repeat(64)});assert.equal(b.ok,true);assert.equal(verifyIntegrityRecords(b.records),true);});
test('rejects tampered decision',()=>{const a=appendIntegrityRecord([],e).records;assert.equal(verifyIntegrityRecords([{...a[0],decision:'forged'}]),false);});
test('rejects missing predecessor',()=>{const a=appendIntegrityRecord([],e).records;const b=appendIntegrityRecord(a,{...e,requestHash:'b'.repeat(64)}).records;assert.equal(verifyIntegrityRecords([b[1]]),false);});
test('rejects reordered records',()=>{const a=appendIntegrityRecord([],e).records;const b=appendIntegrityRecord(a,{...e,requestHash:'b'.repeat(64)}).records;assert.equal(verifyIntegrityRecords([...b].reverse()),false);});
test('rejects append to corrupted chain',()=>{const a=appendIntegrityRecord([],e).records;assert.equal(appendIntegrityRecord([{...a[0],decision:'fake'}],e).reason,'broken-history');});
