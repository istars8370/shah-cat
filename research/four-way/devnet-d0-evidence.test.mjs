import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('D0 runner contains no transaction or signing APIs', async () => {
  const source = await readFile(new URL('./devnet-d0-evidence.mjs', import.meta.url), 'utf8');
  const forbiddenPatterns = [
    /sendTransaction\s*\(/,
    /signTransaction\s*\(/,
    /Keypair\s*\./,
    /SystemProgram\.transfer\s*\(/,
    /sendAndConfirmTransaction\s*\(/,
    /solana\s+program\s+deploy/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(source), false, String(pattern));
  }
});
