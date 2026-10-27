// Read-only RPC transport. No keys, retries, signing or broadcasting.
// Network identity is checked by callers using the returned genesis hash.
const ALLOWED_METHODS = new Set([
  'getGenesisHash', 'getBalance', 'getTokenSupply', 'getTokenAccountsByOwner',
  'getAccountInfo', 'getSignaturesForAddress', 'getTransaction',
  'getLatestBlockhash', 'getFeeForMessage', 'getMinimumBalanceForRentExemption',
  'simulateTransaction',
]);
export function createReadOnlyRpc({ url, fetchImpl = fetch }) {
  let requestId = 0;
  return async function rpc(method, params = []) {
    if (!ALLOWED_METHODS.has(method)) throw Error('rpc-method-forbidden');
    const id = ++requestId;
    let response, payload;
    try {
      response = await fetchImpl(url, {
        method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw Error('rpc-transport-error'); }
    if (response?.ok !== true) throw Error('rpc-http-error');
    try { payload = await response.json(); } catch { throw Error('rpc-response-error'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        payload.jsonrpc !== '2.0' || payload.id !== id || Object.hasOwn(payload, 'error') ||
        !Object.hasOwn(payload, 'result') || payload.result === undefined) throw Error('rpc-response-error');
    return payload.result;
  };
}
