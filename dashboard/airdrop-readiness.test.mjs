import test from 'node:test';
import assert from 'node:assert/strict';
import { airdropReadiness } from './airdrop-readiness.mjs';

test('airdrop readiness requires start, exact origin, and admin token',()=>{
  const bad=airdropReadiness({});
  assert.equal(bad.ready,false);
  assert.deepEqual(new Set(bad.issues),new Set(['AIRDROP_STARTS_AT','AIRDROP_PUBLIC_ORIGIN','AIRDROP_ADMIN_TOKEN']));

  const good=airdropReadiness({
    AIRDROP_STARTS_AT:'2026-11-01T00:00:00.000Z',
    AIRDROP_PUBLIC_ORIGIN:'https://airdrop.example.com',
    AIRDROP_ADMIN_TOKEN:'abcdefghijklmnopqrstuvwxyz123456'
  });
  assert.equal(good.ready,true);
  assert.deepEqual(good.issues,[]);
});

test('airdrop readiness rejects malformed origin and timestamp',()=>{
  const x=airdropReadiness({
    AIRDROP_STARTS_AT:'2026-11-01',
    AIRDROP_PUBLIC_ORIGIN:'airdrop.example.com',
    AIRDROP_ADMIN_TOKEN:'abcdefghijklmnopqrstuvwxyz123456'
  });
  assert.equal(x.ready,false);
  assert.ok(x.issues.includes('AIRDROP_STARTS_AT'));
  assert.ok(x.issues.includes('AIRDROP_PUBLIC_ORIGIN'));
});
