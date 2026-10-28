// Offline, synthetic public labels only. Never queries configured operating wallets.
import test from 'node:test';
import assert from 'node:assert/strict';
import ShahCat from './shared.js';
import {encode58} from './transfer-quote.mjs';
import {walletBalance, createRequestHandler} from './server.mjs';
const address = encode58(Buffer.alloc(32, 1));
const other = encode58(Buffer.alloc(32, 2));
const account = (byte = 3, raw = '1', state = 'initialized') => ({
  pubkey: encode58(Buffer.alloc(32, byte)),
  account: {owner: ShahCat.TOKEN.programId, data: {parsed: {type: 'account', info: {
    owner: address, mint: ShahCat.MINT, state,
    tokenAmount: {amount: raw, decimals: ShahCat.DECIMALS},
  }}}},
});
function fixture(entries = [account()], overrides = {}) {
  const calls = [];
  const query = async (method, params) => {
    calls.push(method);
    if (Object.hasOwn(overrides, method)) return overrides[method](params);
    if (method === 'getGenesisHash') return ShahCat.DEVNET_GENESIS;
    assert.equal(params[0], address);
    if (method === 'getBalance') return {value: 5000};
    if (method === 'getTokenAccountsByOwner') {
      assert.deepEqual(params[1], {mint: ShahCat.MINT});
      return {value: entries};
    }
    assert.fail('Unexpected RPC: ' + method);
  };
  return {query, calls};
}
const mutations = [
  ['wrong program', x => {x.account.owner = other;}],
  ['missing program', x => {delete x.account.owner;}],
  ['Token-2022', x => {x.account.owner = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';}],
  ['wrong type', x => {x.account.data.parsed.type = 'mint';}],
  ['missing type', x => {delete x.account.data.parsed.type;}],
  ['wrong mint', x => {x.account.data.parsed.info.mint = other;}],
  ['missing mint', x => {delete x.account.data.parsed.info.mint;}],
  ['wrong holder', x => {x.account.data.parsed.info.owner = other;}],
  ['missing holder', x => {delete x.account.data.parsed.info.owner;}],
  ['uninitialized state', x => {x.account.data.parsed.info.state = 'uninitialized';}],
  ['missing state', x => {delete x.account.data.parsed.info.state;}],
  ['missing address', x => {delete x.pubkey;}],
  ['invalid address', x => {x.pubkey = 'invalid';}],
];
for (const [name, mutate] of mutations) {
  test('wallet balance rejects ' + name, async () => {
    const entry = account(); mutate(entry);
    await assert.rejects(walletBalance(address, fixture([entry]).query), /Invalid wallet token account/);
  });
}
for (const [name, entries] of [['object', {}], ['string', 'bad'], ['missing', undefined], ['null', null]]) {
  test('wallet balance rejects malformed token list: ' + name, async () => {
    await assert.rejects(walletBalance(address, fixture([], {getTokenAccountsByOwner: () => ({value: entries})}).query), /Invalid wallet token account response/);
  });
}
test('wallet balance rejects duplicate token accounts instead of double counting', async () => {
  const entry = account();
  await assert.rejects(walletBalance(address, fixture([entry, structuredClone(entry)]).query), /Duplicate wallet token account/);
});
test('valid sibling cannot hide a wrong-mint balance', async () => {
  const wrong = account(4); wrong.account.data.parsed.info.mint = other;
  await assert.rejects(walletBalance(address, fixture([account(), wrong]).query), /Invalid wallet token account/);
});
test('genesis change after balances cannot publish a successful snapshot', async () => {
  let count = 0;
  const {query} = fixture([], {getGenesisHash: () => ++count === 1 ? ShahCat.DEVNET_GENESIS : 'wrong-network'});
  await assert.rejects(walletBalance(address, query), /only Solana Devnet/);
});
test('zero holdings remain a valid snapshot', async () => {
  const result = await walletBalance(address, fixture([]).query);
  assert.equal(result.shahRaw, '0');
  assert.equal(result.tokenAccounts, 0);
});
test('initialized and frozen held balances retain single-unit precision', async () => {
  const result = await walletBalance(address, fixture([account(3, '1000000000000000000'), account(4, '1', 'frozen')]).query);
  assert.equal(result.shahRaw, '1000000000000000001');
  assert.equal(result.shah, '1000000000.000000001');
  assert.equal(result.tokenAccounts, 2);
});
for (const raw of ['-1', '18446744073709551616', '1.5']) {
  test('invalid uint64 account balance stays rejected: ' + raw, async () => {
    await assert.rejects(walletBalance(address, fixture([account(3, raw)]).query), /Invalid raw|uint64/);
  });
}
test('bad account returns HTTP failure with no usable balance snapshot', async t => {
  t.mock.method(console, 'error', () => {});
  const wrong = account(); wrong.account.data.parsed.info.mint = other;
  let status, body;
  await createRequestHandler(fixture([wrong]).query)({method: 'GET', url: '/api/wallet?address=' + address}, {
    writeHead(value) {status = value;}, end(value) {body = JSON.parse(value);},
  });
  assert.equal(status, 502);
  assert.equal(body.error, 'Devnet data unavailable or invalid');
  assert.equal(Object.hasOwn(body, 'shahRaw'), false);
  assert.equal(Object.hasOwn(body, 'solLamports'), false);
});
