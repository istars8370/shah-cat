// Checks an existing RPC receipt only. Never signs, broadcasts or authorizes funds.
import { DEVNET_RPC } from './devnet-readonly.mjs';
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const unsignedInteger = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unverified = reason => ({ verified: false, reason });

function validSignature(value) {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)) return false;
  let raw = 0n, bytes = 0;
  for (const character of value) raw = raw * 58n + BigInt(ALPHABET.indexOf(character));
  while (raw > 0n) { bytes++; raw >>= 8n; }
  for (const character of value) { if (character !== '1') break; bytes++; }
  return bytes === 64;
}

export async function verifyDevnetReceipt(signature, { fetchImpl = fetch, rpcUrl = DEVNET_RPC } = {}) {
  if (rpcUrl !== DEVNET_RPC) throw Error('devnet-only');
  if (!validSignature(signature)) throw Error('invalid-signature-format');
  let nextId = 0;
  const call = async (method, params = []) => {
    const id = ++nextId;
    let response, body;
    try {
      response = await fetchImpl(rpcUrl, { method: 'POST', redirect: 'error',
        headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
    } catch { throw Error('rpc-transport-error'); }
    if (!response?.ok) throw Error('rpc-http-error');
    try { body = await response.json(); } catch { throw Error('rpc-response-error'); }
    if (!object(body) || body.jsonrpc !== '2.0' || body.id !== id) throw Error('rpc-response-error');
    if (body.error != null) throw Error('rpc-error');
    if (!Object.hasOwn(body, 'result') || body.result === undefined) throw Error('rpc-response-error');
    return body.result;
  };
  const assertDevnet = async () => {
    if (await call('getGenesisHash') !== DEVNET_GENESIS) throw Error('devnet-genesis-mismatch');
  };
  await assertDevnet();
  const status = await call('getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);
  if (!object(status) || !object(status.context) || !unsignedInteger(status.context.slot) ||
      !Array.isArray(status.value) || status.value.length !== 1) return unverified('invalid-status-response');
  const item = status.value[0];
  if (item === null) return unverified('not-found');
  if (!object(item) || !Object.hasOwn(item, 'err') || item.err === undefined ||
      !unsignedInteger(item.slot) || item.slot > status.context.slot ||
      !['processed', 'confirmed', 'finalized'].includes(item.confirmationStatus)) return unverified('invalid-status-response');
  if (item.err !== null) return unverified('transaction-failed');
  if (item.confirmationStatus !== 'finalized') return { ...unverified('not-finalized'), status: item.confirmationStatus };
  const tx = await call('getTransaction', [signature, { encoding: 'json', commitment: 'finalized', maxSupportedTransactionVersion: 0 }]);
  if (tx === null) return unverified('transaction-unavailable-or-failed');
  if (!object(tx) || !object(tx.meta) || !Object.hasOwn(tx.meta, 'err') || tx.meta.err === undefined) return unverified('invalid-transaction-response');
  if (tx.meta.err !== null) return unverified('transaction-unavailable-or-failed');
  if (!unsignedInteger(tx.slot) || tx.slot !== item.slot) return unverified('receipt-slot-mismatch');
  if (!object(tx.transaction) || !Array.isArray(tx.transaction.signatures) ||
      tx.transaction.signatures[0] !== signature) return unverified('receipt-signature-mismatch');
  if (!unsignedInteger(tx.meta.fee) || (Object.hasOwn(tx.meta, 'computeUnitsConsumed') &&
      !unsignedInteger(tx.meta.computeUnitsConsumed))) return unverified('invalid-receipt-measurements');
  await assertDevnet();
  return { verified: true, signature, slot: tx.slot, feeLamports: tx.meta.fee,
    computeUnitsConsumed: tx.meta.computeUnitsConsumed ?? null, network: 'devnet', genesisHash: DEVNET_GENESIS,
    warning: 'RPC receipt consistency only; does not prove transfer contents, Guardian authorization, Falcon verification, custody security or production readiness' };
}
