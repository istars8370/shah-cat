import test from 'node:test';import assert from 'node:assert/strict';import {canonicalEnvelope,canonicalEnvelopeHash} from './canonical-envelope.mjs';
const a={domain:'SHAH-4WAY-v0',network:'devnet',program:'p',account:'a',mint:'m',recipient:'b',amount:1,nonce:'n',expires:100,policyVersion:1};
test('key order does not change digest',()=>assert.equal(canonicalEnvelopeHash(a),canonicalEnvelopeHash(Object.fromEntries(Object.entries(a).reverse()))));
test('extra field rejected',()=>assert.throws(()=>canonicalEnvelope({...a,extra:'x'}),/unexpected-fields/));
test('noninteger amount rejected',()=>assert.throws(()=>canonicalEnvelope({...a,amount:1.5}),/invalid-integer/));
test('changed recipient changes digest',()=>assert.notEqual(canonicalEnvelopeHash(a),canonicalEnvelopeHash({...a,recipient:'evil'})));
