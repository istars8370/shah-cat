// Gate 2B live read-only Devnet probe.
// This address has no private key in the repository and is for unsigned simulation ONLY.
// Never send real SHAH or SOL to this address. No signer or network write is performed.
import assert from "node:assert/strict";
import ShahCat from "../dashboard/shared.js";
import { deriveAssociatedTokenAddress, quoteUnsignedTransfer } from "../dashboard/transfer-quote.mjs";

const RPC = "https://api.devnet.solana.com";
const TREASURY = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
export const SIMULATION_ONLY_RECIPIENT = "3UaYYNWCNNwsvXvRMgtkwePnHMNreZLSST5618pjMTm9";
const ALLOWED_READ_METHODS = new Set([
  "getGenesisHash","getAccountInfo","getTokenAccountsByOwner","getBalance",
  "getLatestBlockhash","getFeeForMessage","getMinimumBalanceForRentExemption",
  "simulateTransaction",
]);
let nextId = 0;
async function query(method, params = []) {
  if (!ALLOWED_READ_METHODS.has(method)) throw Error("Refused non-read-only RPC method: " + method);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method, params }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw Error("HTTP " + res.status);
      const body = await res.json();
      if (body.error) throw Error("RPC " + JSON.stringify(body.error));
      if (!Object.hasOwn(body, "result")) throw Error("RPC returned no result for " + method);
      return body.result;
    } catch (e) {
      lastError = e;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 800 * attempt));
    }
  }
  throw Error("RPC " + method + " failed after three attempts: " + lastError.message);
}
async function main() {
  // Verify network before any account or fee reads.
  assert.equal(await query("getGenesisHash"), ShahCat.DEVNET_GENESIS, "Only Devnet is permitted");
  const recipientAta = deriveAssociatedTokenAddress(SIMULATION_ONLY_RECIPIENT);
  const existing = await query("getAccountInfo", [recipientAta, {encoding:"jsonParsed",commitment:"confirmed"}]);
  assert.equal(existing?.value, null, "Simulation-only destination unexpectedly has an ATA: do NOT use as missing-ATA case");
  const quote = await quoteUnsignedTransfer({
    sender:TREASURY,
    recipient:SIMULATION_ONLY_RECIPIENT,
    quantity:"1",
  },query);
  assert.equal(quote.network,"devnet");
  assert.equal(quote.recipientAta,recipientAta);
  assert.equal(quote.recipientAtaExists,false);
  assert.equal(quote.requiresAtaCreation,true);
  assert.equal(quote.simulationPassed,true);
  assert.equal(quote.signatureEnabled,false);
  assert.equal(quote.broadcastingEnabled,false);
  assert.ok(BigInt(quote.feeLamports)>0n);
  assert.ok(BigInt(quote.rentLamports)>0n);
  console.log(JSON.stringify({
    environment:"LIVE Solana Devnet read-only RPC",
    scenario:"Missing destination associated token account",
    source:TREASURY, recipient:SIMULATION_ONLY_RECIPIENT,
    mint:quote.mint, recipientAta:quote.recipientAta,
    recipientAtaExists:quote.recipientAtaExists,
    requiresAtaCreation:quote.requiresAtaCreation,
    feeLamports:quote.feeLamports,
    rentLamports:quote.rentLamports,
    simulationPassed:quote.simulationPassed,
    unitsConsumed:quote.unitsConsumed,
    signatureEnabled:quote.signatureEnabled,
    broadcastingEnabled:quote.broadcastingEnabled,
    note:"Simulated only; no private key, no token movement, never send real tokens to simulation-only address",
  },null,2));
}
await main();
