#!/usr/bin/env node
/**
 * SHAH CAT Devnet automatic transfer ledger.
 * Read-only: queries Solana Devnet RPC and writes CSV/Markdown files locally.
 * Node.js 20+, no dependencies, private keys, wallet connections, signing, or broadcasting.
 */
import { writeFile } from "node:fs/promises";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MINT = "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
const NETWORK = "devnet";
const TOKEN_SYMBOL = "SHAH";
const DECIMALS = 9;
const MAX_SIGNATURES_PER_WALLET = Number(process.env.LEDGER_SIGNATURE_LIMIT || 100);

const watchedWallets = new Map([
  ["3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs", "Development"],
  ["9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9", "SHAH Treasury"],
]);

let rpcId = 0;

async function rpc(method, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
    return body.result;
  } finally {
    clearTimeout(timeout);
  }
}

function rawAmount(entry) {
  const value = entry?.uiTokenAmount?.amount;
  return value == null ? 0n : BigInt(value);
}

function formatAmount(raw) {
  const sign = raw < 0n ? "-" : "";
  const absolute = raw < 0n ? -raw : raw;
  const digits = absolute.toString().padStart(DECIMALS + 1, "0");
  const head = digits.slice(0, -DECIMALS);
  const tail = digits.slice(-DECIMALS).replace(/0+$/, "");
  return sign + (tail ? `${head}.${tail}` : head);
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function ownerLabel(owner) {
  return watchedWallets.get(owner) || "External";
}

function collectOwnerBalances(entries) {
  const balances = new Map();
  for (const entry of entries || []) {
    if (entry.mint !== MINT || !entry.owner) continue;
    balances.set(entry.owner, (balances.get(entry.owner) || 0n) + rawAmount(entry));
  }
  return balances;
}

function deriveRows(signature, transaction) {
  const meta = transaction?.meta;
  if (!meta || meta.err) return [];

  const pre = collectOwnerBalances(meta.preTokenBalances);
  const post = collectOwnerBalances(meta.postTokenBalances);
  const owners = new Set([...pre.keys(), ...post.keys()]);
  const changes = [...owners].map(owner => ({
    owner,
    delta: (post.get(owner) || 0n) - (pre.get(owner) || 0n),
  })).filter(item => item.delta !== 0n);

  if (!changes.some(item => watchedWallets.has(item.owner))) return [];

  const debits = changes.filter(item => item.delta < 0n);
  const credits = changes.filter(item => item.delta > 0n);
  if (!debits.length || !credits.length) return [];

  const blockTime = transaction.blockTime
    ? new Date(transaction.blockTime * 1000).toISOString()
    : "";
  const slot = transaction.slot ?? "";

  const rows = [];
  for (const debit of debits) {
    for (const credit of credits) {
      const amount = (-debit.delta < credit.delta) ? -debit.delta : credit.delta;
      if (amount <= 0n) continue;
      rows.push({
        timestamp_utc: blockTime,
        network: NETWORK,
        token_symbol: TOKEN_SYMBOL,
        mint: MINT,
        sender_role: ownerLabel(debit.owner),
        sender_public_address: debit.owner,
        recipient_role: ownerLabel(credit.owner),
        recipient_public_address: credit.owner,
        amount: formatAmount(amount),
        transaction_signature: signature,
        slot,
        status: "confirmed",
      });
    }
  }
  return rows;
}

async function signaturesFor(owner) {
  return rpc("getSignaturesForAddress", [
    owner,
    { limit: MAX_SIGNATURES_PER_WALLET, commitment: "confirmed" },
  ]);
}

async function fetchTransaction(signature) {
  return rpc("getTransaction", [
    signature,
    {
      encoding: "jsonParsed",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    },
  ]);
}

async function main() {
  const genesisHash = await rpc("getGenesisHash", []);
  if (genesisHash !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1") {
    throw new Error("Refusing to run: RPC is not Solana Devnet.");
  }

  const signatures = new Set();
  for (const owner of watchedWallets.keys()) {
    const items = await signaturesFor(owner);
    for (const item of items || []) {
      if (!item.err && item.signature) signatures.add(item.signature);
    }
  }

  const rows = [];
  for (const signature of signatures) {
    const transaction = await fetchTransaction(signature);
    rows.push(...deriveRows(signature, transaction));
  }

  const unique = new Map();
  for (const row of rows) {
    const key = [
      row.transaction_signature,
      row.sender_public_address,
      row.recipient_public_address,
      row.amount,
    ].join("|");
    unique.set(key, row);
  }

  const ordered = [...unique.values()].sort((a, b) =>
    String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)) ||
    String(a.transaction_signature).localeCompare(String(b.transaction_signature))
  );

  const headers = [
    "timestamp_utc",
    "network",
    "token_symbol",
    "mint",
    "sender_role",
    "sender_public_address",
    "recipient_role",
    "recipient_public_address",
    "amount",
    "transaction_signature",
    "slot",
    "status",
  ];
  const csvText = [
    headers.join(","),
    ...ordered.map(row => headers.map(header => csv(row[header])).join(",")),
  ].join("\n") + "\n";

  const checkedAt = new Date().toISOString();
  const mdRows = ordered.length
    ? ordered.map(row =>
        `| ${row.timestamp_utc || "unknown"} | ${row.sender_role} | ${row.recipient_role} | ${row.amount} | \`${row.transaction_signature}\` |`
      ).join("\n")
    : "| - | - | - | - | No matching SHAH transfers found in the scanned window. |";

  const markdown = `# SHAH CAT Devnet automatic ledger

Generated from Solana Devnet RPC. This file is read-only evidence derived from public on-chain data.

- Checked at: **${checkedAt}**
- Mint: \`${MINT}\`
- Watched wallets: **${watchedWallets.size}**
- Signature scan limit per watched wallet: **${MAX_SIGNATURES_PER_WALLET}**
- Matching transfer rows: **${ordered.length}**

| Time (UTC) | Sender role | Recipient role | SHAH | Transaction |
| --- | --- | --- | ---: | --- |
${mdRows}

## Scope and limitations

This ledger only scans recent signatures for the configured Development and SHAH Treasury public addresses. It is not a complete holder ledger, accounting system, tax record, or mainnet record. Complex multi-party token transactions can produce more than one derived row. Always verify material entries against Solana Explorer before relying on them.

The script never requests private keys, signs transactions, or broadcasts transactions.
`;

  await writeFile("docs/devnet-transfer-ledger-auto.csv", csvText, "utf8");
  await writeFile("docs/devnet-transfer-ledger-auto.md", markdown, "utf8");
  console.log(`Wrote ${ordered.length} SHAH transfer row(s).`);
}

main().catch(error => {
  console.error("Ledger sync failed:", error.message);
  process.exitCode = 1;
});
