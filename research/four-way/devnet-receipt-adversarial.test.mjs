import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDevnetReceipt } from './devnet-receipt.mjs';

const signature = '4cdd1oX7cfVALfr26tP52BZ6cSzrgnNGtYD7BFhm6FFeZV5sPTnRvg6NRn8yC6DbEikXcrNChBM5vVJnTgKhGhVu';
const genesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
function fixture(change = () => {}) {
  const data = { genesis, status: { slot: 42, err: null, confirmationStatus: 'finalized' },
    tx: { slot: 42, meta: { err: null, fee: 5000 }, transaction: { signatures: [signature] } } };
  change(data);
  return async (_url, options) => {
    const request = JSON.parse(options.body);
    let result;
    if (request.method === 'getGenesisHash') result = data.genesis;
    else if (request.method === 'getSignatureStatuses') result = { context: { slot: 100 }, value: [data.status] };
    else if (request.method === 'getTransaction') result = data.tx;
    else assert.fail('Unexpected RPC: ' + request.method);
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: request.id, result }) };
  };
}

test('receipt cannot be verified when transaction meta is absent', async () => {
  const result = await verifyDevnetReceipt(signature, { fetchImpl: fixture(data => { delete data.tx.meta; }) });
  assert.equal(result.verified, false);
});
test('a Devnet URL serving a different genesis must be rejected', async () => {
  await assert.rejects(verifyDevnetReceipt(signature, { fetchImpl: fixture(data => { data.genesis = 'mainnet'; }) }), /devnet-genesis-mismatch/);
});
test('transaction signature must match the requested transaction ID', async () => {
  const result = await verifyDevnetReceipt(signature, { fetchImpl: fixture(data => { data.tx.transaction.signatures = ['1'.repeat(64)]; }) });
  assert.equal(result.verified, false);
});
test('finalized status and returned transaction must agree on slot', async () => {
  const result = await verifyDevnetReceipt(signature, { fetchImpl: fixture(data => { data.tx.slot = 43; }) });
  assert.equal(result.verified, false);
});
test('missing transaction error field is not proof of success', async () => {
  const result = await verifyDevnetReceipt(signature, { fetchImpl: fixture(data => { delete data.tx.meta.err; }) });
  assert.equal(result.verified, false);
});
test('unsafe fee values cannot be returned as verified measurements', async () => {
  const result = await verifyDevnetReceipt(signature, { fetchImpl: fixture(data => { data.tx.meta.fee = Number.MAX_SAFE_INTEGER + 1; }) });
  assert.equal(result.verified, false);
});

test('success requires only four read calls, correlated envelopes and a final genesis check', async () => {
  const transport = fixture();
  const requests = [];
  const result = await verifyDevnetReceipt(signature, { fetchImpl: async (url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    assert.equal(url, 'https://api.devnet.solana.com');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    if (request.method === 'getSignatureStatuses') assert.deepEqual(request.params, [[signature], { searchTransactionHistory: true }]);
    if (request.method === 'getTransaction') assert.equal(request.params[1].commitment, 'finalized');
    return transport(url, options);
  } });
  assert.equal(result.verified, true);
  assert.deepEqual(requests.map(request => request.method), ['getGenesisHash','getSignatureStatuses','getTransaction','getGenesisHash']);
  assert.deepEqual(requests.map(request => request.id), [1,2,3,4]);
  assert.equal(result.computeUnitsConsumed, null);
  assert.match(result.warning, /does not prove transfer contents/);
});

test('network change after a consistent receipt cannot return success', async () => {
  const transport = fixture();
  let genesisCalls = 0;
  await assert.rejects(verifyDevnetReceipt(signature, { fetchImpl: async (url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === 'getGenesisHash' && ++genesisCalls === 2) return { ok: true, json: async () => ({ jsonrpc: '2.0', id: request.id, result: 'changed' }) };
    return transport(url, options);
  } }), /devnet-genesis-mismatch/);
});

for (const [name, mutate] of [
  ['missing error state', data => { delete data.status.err; }],
  ['unsafe slot', data => { data.status.slot = Number.MAX_SAFE_INTEGER + 1; }],
  ['future status slot', data => { data.status.slot = 101; }],
  ['missing transaction', data => { data.tx = null; }],
  ['null meta', data => { data.tx.meta = null; }],
  ['negative fee', data => { data.tx.meta.fee = -1; }],
  ['fractional compute units', data => { data.tx.meta.computeUnitsConsumed = 0.5; }],
  ['failed transaction body', data => { data.tx.meta.err = { InstructionError: [0, 'Custom'] }; }],
  ['missing signatures', data => { data.tx.transaction = {}; }],
]) {
  test('fails closed for ' + name, async () => {
    const result = await verifyDevnetReceipt(signature, { fetchImpl: fixture(mutate) });
    assert.equal(result.verified, false);
  });
}

test('signature validation checks decoded 64-byte length before network access', async () => {
  for (const value of ['1'.repeat(63), '1'.repeat(65), '1'.repeat(88), 'z'.repeat(88), '0'.repeat(88)]) {
    await assert.rejects(verifyDevnetReceipt(value, { fetchImpl: () => assert.fail('Invalid input must not access RPC') }), /invalid-signature-format/);
  }
});

test('malformed or uncorrelated JSON-RPC responses cannot verify a receipt', async () => {
  for (const body of [null, [], { jsonrpc: '2.0', id: 999, result: genesis },
    { id: 1, result: genesis }, { jsonrpc: '2.0', id: 1 },
    { jsonrpc: '2.0', id: 1, result: genesis, error: { code: -1 } }]) {
    await assert.rejects(verifyDevnetReceipt(signature, { fetchImpl: async () => ({ ok: true, json: async () => body }) }), /rpc-/);
  }
});

test('transport, HTTP and JSON parse failures are rejected without retrying', async () => {
  for (const response of [() => { throw Error('network'); }, () => ({ ok: false, status: 429 }),
    () => ({ ok: true, json: async () => { throw Error('bad JSON'); } })]) {
    let calls = 0;
    await assert.rejects(verifyDevnetReceipt(signature, { fetchImpl: async () => { calls++; return response(); } }), /rpc-/);
    assert.equal(calls, 1);
  }
});
