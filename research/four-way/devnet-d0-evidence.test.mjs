import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('D0 runner contains no transaction/signing APIs', async () => {
  const source = await readFile(new URL('./devnet-d0-evidence.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['sendTransaction','signTransaction','Keypair','transfer(','deploy']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
