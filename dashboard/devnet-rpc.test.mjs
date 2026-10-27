import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadOnlyRpc } from './devnet-rpc.mjs';
import { createRequestHandler } from './server.mjs';

// Reserved hostname is never contacted: fetch is always injected.
const url = 'https://rpc.invalid.example';
function fixture(mutate = x => x) {
  const calls = [];
  const rpc = createReadOnlyRpc({ url, fetchImpl: async (endpoint, options) => {
    const body = JSON.parse(options.body);
    calls.push({endpoint, options, body});
    return {ok: true, json: async () => mutate({jsonrpc: '2.0', id: body.id, result: 'synthetic-result'})};
  }});
  return {rpc, calls};
}
const invalidEnvelopes = [
  ['null', () => null], ['array', () => []], ['primitive', () => 'synthetic'],
  ['missing-version', ({jsonrpc, ...rest}) => rest],
  ['wrong-version', x => ({...x, jsonrpc: '1.0'})],
  ['missing-id', ({id, ...rest}) => rest],
  ['wrong-id', x => ({...x, id: x.id + 1})],
  ['string-id', x => ({...x, id: String(x.id)})],
  ['null-id', x => ({...x, id: null})],
  ['missing-result', ({result, ...rest}) => rest],
  ['undefined-result', x => ({...x, result: undefined})],
  ['both-result-and-error', x => ({...x, error: {code: -1, message: 'synthetic'}})],
  ['false-error', x => ({...x, error: false})],
  ['null-error-with-result', x => ({...x, error: null})],
];
for (const [name, mutate] of invalidEnvelopes) {
  test('RPC rejects ' + name + ' without retry', async () => {
    const {rpc, calls} = fixture(mutate);
    await assert.rejects(rpc('getGenesisHash'), /rpc-response-error/);
    assert.equal(calls.length, 1);
  });
}
test('RPC accepts explicit null account result and pins request policy', async () => {
  const {rpc, calls} = fixture(x => ({...x, result: null}));
  assert.equal(await rpc('getAccountInfo', ['synthetic-public-label']), null);
  assert.equal(calls[0].endpoint, url);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].body.jsonrpc, '2.0');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});
test('RPC preserves explicit false, zero and empty-string results', async () => {
  for (const result of [false, 0, '']) {
    const {rpc} = fixture(x => ({...x, result}));
    assert.equal(await rpc('getGenesisHash'), result);
  }
});
test('RPC refuses mutation and unknown methods before fetch', async () => {
  const {rpc, calls} = fixture();
  for (const method of ['sendTransaction', 'sendRawTransaction', 'requestAirdrop', 'unknown']) {
    await assert.rejects(rpc(method), /rpc-method-forbidden/);
  }
  assert.equal(calls.length, 0);
});
for (const stage of ['transport', 'http', 'json', 'rpc']) {
  test('RPC ' + stage + ' errors discard sentinel, cause and raw response', async () => {
    const sentinel = 'SYNTHETIC_SENSITIVE_ENDPOINT_OR_PAYLOAD';
    let count = 0;
    const rpc = createReadOnlyRpc({url, fetchImpl: async (_url, options) => {
      ++count;
      if (stage === 'transport') throw Error(sentinel);
      return {ok: stage !== 'http', status: 500, async json() {
        if (stage === 'json') throw Error(sentinel);
        return {jsonrpc: '2.0', id: JSON.parse(options.body).id, error: {message: sentinel}};
      }};
    }});
    await assert.rejects(rpc('getGenesisHash'), error => {
      assert.ok(!String(error).includes(sentinel));
      assert.equal(error.cause, undefined);
      return /^rpc-(transport|http|response)-error$/.test(error.message);
    });
    assert.equal(count, 1);
  });
}
test('concurrent out-of-order responses match their own request IDs', async () => {
  const pending = [];
  const rpc = createReadOnlyRpc({url, fetchImpl: (_url, options) => new Promise(resolve => {
    pending.push(() => resolve({ok: true, json: async () => ({
      jsonrpc: '2.0', id: JSON.parse(options.body).id, result: JSON.parse(options.body).method,
    })}));
  })});
  const first = rpc('getGenesisHash');
  const second = rpc('getBalance', ['synthetic']);
  pending[1](); pending[0]();
  assert.deepEqual(await Promise.all([first, second]), ['getGenesisHash', 'getBalance']);
});
test('HTTP and logging discard arbitrary failure payloads', async t => {
  const sentinel = 'SYNTHETIC_SENSITIVE_ENDPOINT_OR_PAYLOAD';
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  for (const status of [undefined, 400, 409]) {
    let responseStatus, body;
    const failure = Object.assign(Error(sentinel), {status, extra: sentinel});
    await createRequestHandler(async () => {throw failure;})({method: 'GET', url: '/api/wallet?address=11111111111111111111111111111111'}, {
      writeHead(value) {responseStatus = value;}, end(value) {body = value;},
    });
    assert.equal(responseStatus, status || 502);
    assert.ok(!body.includes(sentinel));
  }
  assert.ok(!JSON.stringify(logs).includes(sentinel));
});
