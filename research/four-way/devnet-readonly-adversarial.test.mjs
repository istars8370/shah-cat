import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDevnet } from './devnet-readonly.mjs';

const genesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
function fixture({ hash = genesis, slot = 123, version = { 'solana-core': '3.1.8', 'feature-set': 1 }, envelope = value => value } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url, options, request });
    const result = request.method === 'getGenesisHash' ? (typeof hash === 'function' ? hash() : hash)
      : request.method === 'getSlot' ? slot : version;
    return { ok: true, json: async () => envelope({ jsonrpc: '2.0', id: request.id, result }) };
  };
  return { calls, fetchImpl };
}

test('rejects wrong genesis before any slot or version query', async () => {
  const { calls, fetchImpl } = fixture({ hash: 'wrong-cluster' });
  await assert.rejects(inspectDevnet(fetchImpl), /devnet-genesis-mismatch/);
  assert.deepEqual(calls.map(call => call.request.method), ['getGenesisHash']);
});
test('rejects unsafe finalized slot instead of reporting a valid Devnet inspection', async () => {
  await assert.rejects(inspectDevnet(fixture({ slot: Number.MAX_SAFE_INTEGER + 1 }).fetchImpl), /invalid-devnet-slot/);
});
test('rejects missing software version metadata', async () => {
  await assert.rejects(inspectDevnet(fixture({ version: {} }).fetchImpl), /invalid-devnet-version/);
});
test('rejects responses that do not match the request ID', async () => {
  await assert.rejects(inspectDevnet(fixture({ envelope: body => ({ ...body, id: 'other-request' }) }).fetchImpl), /rpc-response-error/);
});
test('checks genesis again before returning a successful inspection', async () => {
  let reads = 0;
  await assert.rejects(inspectDevnet(fixture({ hash: () => ++reads === 1 ? genesis : 'changed' }).fetchImpl), /devnet-genesis-mismatch/);
});
test('rejects negative slots rather than returning misleading measurements', async () => {
  await assert.rejects(inspectDevnet(fixture({ slot: -1 }).fetchImpl), /invalid-devnet-slot/);
});

test('successful inspection is bounded, finalized, correlated and read-only', async () => {
  const { calls, fetchImpl } = fixture();
  const result = await inspectDevnet(fetchImpl);
  assert.equal(result.genesisHash, genesis);
  assert.equal(result.commitment, 'finalized');
  assert.equal(result.transfersEnabled, false);
  assert.match(result.warning, /not transaction/);
  assert.deepEqual(calls.map(call => call.request.method), ['getGenesisHash','getSlot','getVersion','getGenesisHash']);
  assert.deepEqual(calls.map(call => call.request.id), [1,2,3,4]);
  assert.deepEqual(calls[1].request.params, [{ commitment: 'finalized' }]);
  for (const call of calls) {
    assert.equal(call.url, 'https://api.devnet.solana.com');
    assert.equal(call.options.redirect, 'error');
    assert.ok(call.options.signal instanceof AbortSignal);
  }
});

test('rejects malformed slot and version measurements without later reads', async () => {
  for (const slot of [null, '123', 0.5, NaN, Infinity]) {
    const { calls, fetchImpl } = fixture({ slot });
    await assert.rejects(inspectDevnet(fetchImpl), /invalid-devnet-slot/);
    assert.deepEqual(calls.map(call => call.request.method), ['getGenesisHash','getSlot']);
  }
  for (const version of [null, [], {}, { 'solana-core': '' }, { 'solana-core': 3 },
    { 'solana-core': '3.1.8', 'feature-set': -1 }, { 'solana-core': '3.1.8', 'feature-set': 0x100000000 },
    { 'solana-core': '3.1.8', 'feature-set': '1' }]) {
    await assert.rejects(inspectDevnet(fixture({ version }).fetchImpl), /invalid-devnet-version/);
  }
});

test('supports documented omitted or null feature-set without inventing a value', async () => {
  for (const version of [{ 'solana-core': '3.1.8' }, { 'solana-core': '3.1.8', 'feature-set': null },
    { 'solana-core': '3.1.8', 'feature-set': 0xffffffff }]) {
    assert.deepEqual((await inspectDevnet(fixture({ version }).fetchImpl)).version, version);
  }
});

test('malformed JSON-RPC envelopes and missing results cannot pass', async () => {
  for (const envelope of [() => null, () => [], body => ({ ...body, jsonrpc: '1.0' }),
    body => { delete body.result; return body; }, body => ({ ...body, error: { code: -1 } })]) {
    await assert.rejects(inspectDevnet(fixture({ envelope }).fetchImpl), /rpc-response-error/);
  }
});

test('HTTP, JSON and transport errors fail without automatic retries', async () => {
  for (const response of [() => ({ ok: false, status: 429 }), () => { throw Error('network'); },
    () => ({ ok: true, json: async () => { throw Error('JSON'); } })]) {
    let calls = 0;
    await assert.rejects(inspectDevnet(async () => { calls++; return response(); }), /rpc-/);
    assert.equal(calls, 1);
  }
});
