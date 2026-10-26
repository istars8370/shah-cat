// Research-only network inspection. No keys, signing, broadcasting or deployment.
export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unsignedInteger = value => Number.isSafeInteger(value) && value >= 0;

export async function inspectDevnet(fetchImpl = fetch, url = DEVNET_RPC) {
  if (url !== DEVNET_RPC) throw Error('devnet-only');
  let nextId = 0;
  const call = async (method, params = []) => {
    const id = ++nextId;
    let response, data;
    try {
      response = await fetchImpl(url, { method: 'POST', redirect: 'error',
        headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
    } catch { throw Error('rpc-transport-error'); }
    if (!response?.ok) throw Error('rpc-http-error');
    try { data = await response.json(); } catch { throw Error('rpc-response-error'); }
    if (!object(data) || data.jsonrpc !== '2.0' || data.id !== id || data.error != null ||
        !Object.hasOwn(data, 'result') || data.result === undefined) throw Error('rpc-response-error');
    return data.result;
  };
  const assertDevnet = async () => {
    const value = await call('getGenesisHash');
    if (value !== DEVNET_GENESIS) throw Error('devnet-genesis-mismatch');
    return value;
  };
  const genesisHash = await assertDevnet();
  // Gate secondary reads on the actual genesis, not merely the RPC hostname.
  const slot = await call('getSlot', [{ commitment: 'finalized' }]);
  if (!unsignedInteger(slot)) throw Error('invalid-devnet-slot');
  const version = await call('getVersion');
  if (!object(version) || typeof version['solana-core'] !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$/.test(version['solana-core']) ||
      (Object.hasOwn(version, 'feature-set') && version['feature-set'] !== null &&
        (!unsignedInteger(version['feature-set']) || version['feature-set'] > 0xffffffff))) throw Error('invalid-devnet-version');
  await assertDevnet();
  return { network: 'devnet', genesisHash, slot, version, commitment: 'finalized',
    readOnly: true, transfersEnabled: false,
    warning: 'RPC-reported network metadata only; not transaction, Guardian, Falcon, custody or deployment evidence' };
}
