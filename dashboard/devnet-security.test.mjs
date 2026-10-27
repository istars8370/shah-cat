// Synthetic public bytes only: no wallet/key generation or live adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import ShahCat from './shared.js';
import { transferReadiness } from './transfer-preflight.mjs';
import { createRequestHandler } from './server.mjs';
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

const invalidSourceRecords = [
  ['missing-program-owner', entry => {delete entry.account.owner;}],
  ['wrong-program-owner', entry => {entry.account.owner = '11111111111111111111111111111111';}],
  ['token-2022-program', entry => {entry.account.owner = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';}],
  ['missing-parsed-type', entry => {delete entry.account.data.parsed.type;}],
  ['mint-parsed-type', entry => {entry.account.data.parsed.type = 'mint';}],
  ['multisig-parsed-type', entry => {entry.account.data.parsed.type = 'multisig';}],
  ['null-parsed-type', entry => {entry.account.data.parsed.type = null;}],
];
for (const [name, mutate] of invalidSourceRecords) {
  test('preflight and quote reject invalid source envelope: ' + name, async () => {
    for (const action of [transferReadiness, quoteUnsignedTransfer]) {
      const entry = {pubkey: source, account: token(sender)};
      mutate(entry);
      const {query, calls} = fixture({getTokenAccountsByOwner: () => ({value: [entry]})});
      await assert.rejects(action(input, query), /Unexpected SHAH token account data/);
      assert.ok(!calls.includes('getAccountInfo'));
      assert.ok(!calls.includes('getFeeForMessage'));
      assert.ok(!calls.includes('simulateTransaction'));
    }
  });
}

test('valid sufficient sibling cannot hide an invalid source envelope', async () => {
  const invalid = {pubkey: source, account: token(sender)};
  invalid.account.owner = '11111111111111111111111111111111';
  invalid.account.data.parsed.info.state = 'frozen';
  const {query} = fixture({getTokenAccountsByOwner: () => ({value: [
    {pubkey: sender, account: token(sender)}, invalid,
  ]})});
  await assert.rejects(transferReadiness(input, query), /Unexpected SHAH token account data/);
});

test('canonical source remains usable with a genuine frozen sibling', async () => {
  const frozen = token(sender);
  frozen.data.parsed.info.state = 'frozen';
  const {query} = fixture({getTokenAccountsByOwner: () => ({value: [
    {pubkey: recipient, account: frozen}, {pubkey: source, account: token(sender)},
  ]})});
  const result = await transferReadiness(input, query);
  assert.equal(result.sourceTokenAccount, source);
  assert.equal(result.signatureEnabled, false);
  assert.equal(result.broadcastingEnabled, false);
});

test('HTTP preflight and quote cannot publish success for an invalid source program', async t => {
  t.mock.method(console, 'error', () => {});
  for (const route of ['/api/preflight', '/api/quote']) {
    const entry = {pubkey: source, account: token(sender)};
    entry.account.owner = '11111111111111111111111111111111';
    const {query, calls} = fixture({getTokenAccountsByOwner: () => ({value: [entry]})});
    let status, body;
    await createRequestHandler(query)({method: 'GET', url: route + '?' + new URLSearchParams({sender, recipient, amount: '1'})}, {
      writeHead(value) {status = value;}, end(value) {body = JSON.parse(value);},
    });
    assert.equal(status, 502);
    assert.equal(body.error, 'Devnet data unavailable or invalid');
    assert.equal(Object.hasOwn(body, 'eligibleForConstruction'), false);
    assert.equal(Object.hasOwn(body, 'simulationPassed'), false);
    assert.ok(!calls.includes('simulateTransaction'));
  }
});
