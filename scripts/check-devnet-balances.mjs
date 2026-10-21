#!/usr/bin/env node
/**
 * SHAH CAT Devnet read-only balance check.
 * Node.js 20+; no dependencies, keys, or wallet connections.
 */
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MINT = "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const wallets = [
  ["Development", "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs"],
  ["SHAH Treasury", "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9"],
];
let id = 0;
async function rpc(method, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`RPC ${method}: ${data.error.message}`);
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}
function formatAmount(raw, decimals) {
  const digits = BigInt(raw).toString().padStart(decimals + 1, "0");
  if (decimals === 0) return digits;
  const head = digits.slice(0, -decimals);
  const tail = digits.slice(-decimals).replace(/0+$/, "");
  return tail ? `${head}.${tail}` : head;
}
async function main() {
  const supply = await rpc("getTokenSupply", [MINT, { commitment: "confirmed" }]);
  const decimals = supply.value.decimals;
  console.log("SHAH CAT | Solana Devnet | read-only");
  console.log(`Checked at: ${new Date().toISOString()}`);
  console.log(`Mint: ${MINT}`);
  console.log(`Total supply: ${formatAmount(supply.value.amount, decimals)} SHAH`);
  for (const [role, owner] of wallets) {
    const result = await rpc("getTokenAccountsByOwner", [
      owner,
      { mint: MINT },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]);
    const total = result.value.reduce((sum, entry) => {
      const amount = entry.account.data.parsed.info.tokenAmount.amount;
      return sum + BigInt(amount);
    }, 0n);
    console.log(`${role}: ${formatAmount(total, decimals)} SHAH (${result.value.length} token account(s))`);
  }
  console.log("Note: only listed wallets are counted; not a full holder distribution.");
}
main().catch((err) => {
  console.error("Balance check failed:", err.message);
  process.exitCode = 1;
});
