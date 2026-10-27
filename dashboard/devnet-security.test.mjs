// Synthetic public bytes only: no wallet/key generation or live adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import ShahCat from './shared.js';
import { encode58, isOnCurve, deriveAssociatedTokenAddress, TOKEN_PROGRAM, quoteUnsignedTransfer } from './transfer-quote.mjs';

const publicLabels = Array.from({length: 16}, (_, i) => Buffer.alloc(32, i + 1)).filter(isOnCurve).map(encode58);
const [sender, recipient, source] = publicLabels;
const ata = deriveAssociatedTokenAddress(recipient);
const input = { sender, recipient, quantity: '1' };
const token = owner => ({ owner: TOKEN_PROGRAM, data: { parsed: { type: 'account', info: {
  owner, mint: ShahCat.MINT, state: 'initialized', tokenAmount: { amount: '2000000000', decimals: 9 },
} } } });
function fixture(overrides = {}) {
  const calls = [];
  const query = async (method, params) => {
    calls.push(method);
    if (Object.hasOwn(overrides, method)) return overrides[method](params, calls);
    switch (method) {
      case 'getGenesisHash': return ShahCat.DEVNET_GENESIS;
      case 'getBalance': return { value: 50000000 };
      case 'getTokenAccountsByOwner': return { value: [{ pubkey: source, account: token(sender) }] };
      case 'getAccountInfo': return { value: params[0] === ShahCat.MINT
        ? { owner: TOKEN_PROGRAM, data: { parsed: { type: 'mint', info: { decimals: 9, isInitialized: true } } } }
        : token(params[0] === source ? sender : recipient) };
      case 'getLatestBlockhash': return { value: { blockhash: encode58(Buffer.alloc(32, 23)), lastValidBlockHeight: 1000 } };
      case 'getFeeForMessage': return { value: 5000 };
      case 'getMinimumBalanceForRentExemption': return 2039280;
      case 'simulateTransaction': {
        const wire = Buffer.from(params[0], 'base64');
        assert.equal(wire[0], 1);
        assert.deepEqual(wire.subarray(1, 65), Buffer.alloc(64));
        assert.equal(params[1].sigVerify, false);
        assert.equal(params[1].replaceRecentBlockhash, false);
        return { value: { err: null } };
      }
      default: assert.fail('Forbidden RPC method: ' + method);
    }
  };
  return { query, calls };
}

test('synthetic quote never exposes signing or broadcast permission', async () => {
  assert.ok(sender && recipient && source);
  assert.ok(!ShahCat.OWNERS.some(x => [sender, recipient, source].includes(x.address)));
  const { query, calls } = fixture();
  const result = await quoteUnsignedTransfer(input, query);
  assert.equal(result.signatureEnabled, false);
  assert.equal(result.broadcastingEnabled, false);
  assert.equal(result.simulationPassed, true);
  assert.equal(calls.filter(x => x === 'simulateTransaction').length, 1);
});

test('explicitly absent ATA still supports unsigned create-idempotent simulation', async () => {
  const base = fixture();
  const {query} = fixture({getAccountInfo: params => params[0] === ata ? {value: null} : base.query('getAccountInfo', params)});
  const result = await quoteUnsignedTransfer(input, query);
  assert.equal(result.requiresAtaCreation, true);
  assert.equal(result.rentLamports, '2039280');
  assert.equal(result.signatureEnabled, false);
});

for (const [index, malformed] of [undefined, null, {}, {value: undefined}, {value: []}, {value: false}].entries()) {
  test('malformed ATA lookup cannot authorize construction: ' + index, async () => {
    const base = fixture();
    const { query, calls } = fixture({getAccountInfo: params => params[0] === ata ? malformed : base.query('getAccountInfo', params)});
    await assert.rejects(quoteUnsignedTransfer(input, query), /Recipient ATA|Invalid recipient ATA/);
    assert.ok(!calls.includes('simulateTransaction'));
    assert.ok(!calls.includes('getFeeForMessage'));
  });
}

for (const height of [undefined, null, -1, 1.5, '1000', Number.MAX_SAFE_INTEGER + 1]) {
  test('malformed block height fails before simulation: ' + String(height), async () => {
    const {query, calls} = fixture({getLatestBlockhash: () => ({value: {
      blockhash: encode58(Buffer.alloc(32, 23)), lastValidBlockHeight: height,
    }})});
    await assert.rejects(quoteUnsignedTransfer(input, query), /block.*height/i);
    assert.ok(!calls.includes('simulateTransaction'));
  });
}

test('network change during simulation cannot return success', async () => {
  let reads = 0;
  const {query} = fixture({getGenesisHash: () => ++reads < 3 ? ShahCat.DEVNET_GENESIS : 'wrong-network'});
  await assert.rejects(quoteUnsignedTransfer(input, query), /cluster changed after simulation/);
});

test('untrusted simulation errors do not echo raw RPC payload', async () => {
  const sentinel = 'SYNTHETIC_SENSITIVE_RPC_PAYLOAD';
  const {query} = fixture({simulateTransaction: () => ({value: {err: {detail: sentinel}, logs: [sentinel]}})});
  await assert.rejects(quoteUnsignedTransfer(input, query), error =>
    /unsigned simulation failed/.test(error.message) && !error.message.includes(sentinel));
});
