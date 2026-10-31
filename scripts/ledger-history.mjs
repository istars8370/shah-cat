import { parseCsv as parseRecords } from "./notify-telegram-ledger.mjs";
import { transferKey } from "./telegram-delivery-state.mjs";
export const HEADERS = ["timestamp_utc","network","token_symbol","mint","transfer_class","sender_role","sender_public_address","recipient_role","recipient_public_address","amount","transaction_signature","slot","status"];

export function parseCsv(text) {
  if (!text.trim()) return [];
  const rows = parseRecords(text);
  const firstLine = text.split(/\r?\n/, 1)[0];
  if (firstLine !== HEADERS.join(",")) throw new Error("Ledger CSV schema mismatch");
  for (const row of rows) {
    if (Object.keys(row).length !== HEADERS.length || !row.transaction_signature) throw new Error("Malformed ledger CSV row");
  }
  return rows;
}

export function rowKey(row) {
  return transferKey(row);
}

export function mergeRows(previous, incoming) {
  const merged = new Map();
  for (const row of [...previous, ...incoming]) merged.set(rowKey(row), row);
  return [...merged.values()].sort((a,b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)) || String(a.transaction_signature).localeCompare(String(b.transaction_signature)));
}

export async function scanSignatures(owner, checkpoint, rpc, options={}) {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 20;
  const found = [];
  let before;
  for (let page=0; page<maxPages; page++) {
    const query = {limit:pageSize,commitment:"confirmed"};
    if (before) query.before = before;
    const entries = await rpc("getSignaturesForAddress",[owner,query]);
    if (!Array.isArray(entries)) throw new Error("Invalid signature response for "+owner);
    for (const entry of entries) {
      if (checkpoint && entry.signature === checkpoint) return found;
      if (entry.signature && !entry.err) found.push(entry.signature);
    }
    if (entries.length < pageSize) {
      if (checkpoint) throw new Error("Checkpoint missing from RPC history for "+owner);
      return found;
    }
    before = entries.at(-1)?.signature;
    if (!before) throw new Error("Invalid pagination cursor for "+owner);
  }
  throw new Error("Signature scan limit exceeded for "+owner+"; checkpoint not reached");
}
