import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync(new URL('../../dashboard/fixtures/solana-sdk-reference.json', import.meta.url), 'utf8'));
test('immutable reference fixture has six cases and 38 owner ATAs', () => {
  assert.equal(fixture.cases.length, 6);
  assert.equal(fixture.atas.length, 38);
});
