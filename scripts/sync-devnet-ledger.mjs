#!/usr/bin/env node
/**
 * SHAH CAT Devnet automatic transfer ledger.
 * Read-only: queries Solana Devnet RPC and writes CSV/Markdown files locally.
 * Node.js 20+, no dependencies, private keys, wallet connections, signing, or broadcasting.
 */
import { readFile, writeFile } from "node:fs/promises";
import { HEADERS, parseCsv, mergeRows, scanSignatures } from "./ledger-history.mjs";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MINT = "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
const NETWORK = "devnet";
const TOKEN_SYMBOL = "SHAH";
const DECIMALS = 9;
const PAGE_SIZE = Number(process.env.LEDGER_SIGNATURE_LIMIT || 100);
const MAX_PAGES = Number(process.env.LEDGER_MAX_PAGES || 20);
const RPC_MAX_ATTEMPTS = Number(process.env.LEDGER_RPC_MAX_ATTEMPTS || 6);
const RPC_MIN_DELAY_MS = Number(process.env.LEDGER_RPC_MIN_DELAY_MS || 350);

const watchedWallets = new Map([
  ["3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs", "Development"],
  ["9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9", "Founder / Treasury"],
  ["vXDm1gfzSA6EVGJqPbGbFLoUX9iBfPoz8Byf712YNvW", "Operations Whale"],
]);

watchedWallets.set("7hMqrhWEoXLRXMuAywwTMEdFm96YyEemaLoFLBU8UnzC", "Investor Whale");

let rpcId = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rpc(method, params) {
  for (let attempt = 1; attempt <= RPC_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        if (attempt === RPC_MAX_ATTEMPTS) throw new Error("RPC HTTP 429 after retries");
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(16000, 1000 * (2 ** (attempt - 1)));
        console.warn(`RPC rate limited on ${method}; retrying in ${backoff} ms (attempt ${attempt}/${RPC_MAX_ATTEMPTS})`);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const body = await response.json();
      if (body.error) {
        const code = Number(body.error.code);
        const rateLimited = code === 429 || /too many requests|rate limit/i.test(String(body.error.message || ""));
        if (rateLimited && attempt < RPC_MAX_ATTEMPTS) {
          const backoff = Math.min(16000, 1000 * (2 ** (attempt - 1)));
          console.warn(`RPC rate limited on ${method}; retrying in ${backoff} ms (attempt ${attempt}/${RPC_MAX_ATTEMPTS})`);
          await sleep(backoff);
          continue;
        }
        throw new Error(`RPC ${method}: ${body.error.message}`);
      }
      await sleep(RPC_MIN_DELAY_MS);
      return body.result;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`RPC ${method}: retry limit exceeded`);
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

function transferClass(sender, recipient) {
  const from = ownerLabel(sender);
  const to = ownerLabel(recipient);
  const fromWhale = /Whale|Founder \/ Treasury/.test(from);
  const toWhale = /Whale|Founder \/ Treasury/.test(to);
  const fromTreasury = from === "Founder / Treasury";
  const toTreasury = to === "Founder / Treasury";

  if (fromTreasury && toWhale && !toTreasury) return "treasury_to_whale";
  if (fromWhale && !fromTreasury && toTreasury) return "whale_to_treasury";
  if (fromWhale && toWhale) return "whale_to_whale";
  if (fromTreasury && to === "External") return "treasury_outbound";
  if (from === "External" && toTreasury) return "treasury_inbound";
  if (fromWhale && to === "External") return "whale_outbound";
  if (from === "External" && toWhale) return "whale_inbound";
  return "development_or_other";
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
        transfer_class: transferClass(debit.owner, credit.owner),
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
  if (genesisHash !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") {
    throw new Error("Refusing to run: RPC is not Solana Devnet.");
  }

  const previousCsv = await readFile("docs/devnet-transfer-ledger-auto.csv", "utf8").catch(error => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const checkpoints = JSON.parse(await readFile("docs/devnet-ledger-checkpoints.json", "utf8").catch(error => {
    if (error.code === "ENOENT") return "{}";
    throw error;
  }));
  const nextCheckpoints = {...checkpoints};
  const signatures = new Set();
  for (const owner of watchedWallets.keys()) {
    const found = await scanSignatures(owner, checkpoints[owner], rpc, {pageSize:PAGE_SIZE,maxPages:MAX_PAGES});
    for (const signature of found) signatures.add(signature);
    if (found.length) nextCheckpoints[owner] = found[0];
  }

  const rows = [];
  for (const signature of signatures) {
    const transaction = await fetchTransaction(signature);
    rows.push(...deriveRows(signature, transaction));
  }

  const ordered = mergeRows(parseCsv(previousCsv), rows);
  const headers = HEADERS;
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
- Signature scan page size: **${PAGE_SIZE}**, max pages: **${MAX_PAGES}**
- Matching transfer rows: **${ordered.length}**

| Time (UTC) | Class | Sender role | Recipient role | SHAH | Transaction |
| --- | --- | --- | --- | ---: | --- |
${ordered.length
  ? ordered.map(row =>
      `| ${row.timestamp_utc || "unknown"} | ${row.transfer_class} | ${row.sender_role} | ${row.recipient_role} | ${row.amount} | \`${row.transaction_signature}\` |`
    ).join("\n")
  : "| - | - | - | - | - | No matching SHAH transfers found in the scanned window. |"}

## Scope and limitations

This ledger scans recent signatures for the configured Development wallet and representative SHAH whale wallets. The Founder wallet currently also serves as the SHAH Treasury public wallet. An Investor Whale address can be added through the PARK_WALLET environment variable until its public address is formally recorded. It is not a complete holder ledger, accounting system, tax record, or mainnet record. Complex multi-party token transactions can produce more than one derived row. Always verify material entries against Solana Explorer before relying on them.

The script never requests private keys, signs transactions, or broadcasts transactions.
`;

  await writeFile("docs/devnet-transfer-ledger-auto.csv", csvText, "utf8");
  await writeFile("docs/devnet-transfer-ledger-auto.md", markdown, "utf8");
  await writeFile("docs/devnet-ledger-checkpoints.json", JSON.stringify(nextCheckpoints, null, 2) + "\n", "utf8");
  console.log(`Wrote ${ordered.length} SHAH transfer row(s).`);
}

main().catch(error => {
  console.error("Ledger sync failed:", error.message);
  process.exitCode = 1;
});
