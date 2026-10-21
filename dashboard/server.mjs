// SHAH CAT local read-only dashboard server (Node.js 20+; no dependencies).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const port = Number(process.env.PORT || 4173);
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MINT = "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
const owners = [
  { role: "Development", address: "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs" },
  { role: "SHAH Treasury", address: "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9" },
];
let requestId = 0;
async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Devnet RPC HTTP " + response.status);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}
function amount(raw, decimals) {
  const s = BigInt(raw).toString().padStart(decimals + 1, "0");
  if (!decimals) return s;
  const fractional = s.slice(-decimals).replace(/0+$/, "");
  return s.slice(0, -decimals) + (fractional ? "." + fractional : "");
}
async function balances() {
  const supply = await rpc("getTokenSupply", [MINT, { commitment: "confirmed" }]);
  const decimals = supply.value.decimals;
  const wallets = [];
  for (const wallet of owners) {
    const result = await rpc("getTokenAccountsByOwner", [
      wallet.address, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" },
    ]);
    const total = result.value.reduce((sum, item) =>
      sum + BigInt(item.account.data.parsed.info.tokenAmount.amount), 0n);
    wallets.push({ ...wallet, balance: amount(total, decimals), tokenAccounts: result.value.length });
  }
  const mintInfo = await rpc("getAccountInfo", [MINT, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const info = mintInfo?.value?.data?.parsed?.info;
  return {
    checkedAt: new Date().toISOString(), network: "devnet", mint: MINT,
    supply: amount(supply.value.amount, decimals), decimals, wallets,
    mintAuthority: info?.mintAuthority ?? null,
    freezeAuthority: info?.freezeAuthority ?? null,
  };
}

// Recent on-chain activity for the Treasury's SHAH token accounts (read-only).
async function recentTransfers() {
  const treasury = owners[1].address;
  const accounts = await rpc("getTokenAccountsByOwner", [
    treasury, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const addresses = accounts.value.map(x => x.pubkey);
  const signatures = new Map();
  for (const address of addresses) {
    const list = await rpc("getSignaturesForAddress", [address, { limit: 20, commitment: "confirmed" }]);
    for (const item of list) signatures.set(item.signature, item);
  }
  const latest = [...signatures.values()].sort((x,y)=>(y.blockTime||0)-(x.blockTime||0)).slice(0,20);
  const results = [];
  for (const item of latest) {
    const tx = await rpc("getTransaction", [item.signature, {
      encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed",
    }]);
    if (!tx?.meta || tx.meta.err) continue;
    const before = tx.meta.preTokenBalances || [];
    const after = tx.meta.postTokenBalances || [];
    const sum = arr => arr.filter(x=>x.mint===MINT && x.owner===treasury)
      .reduce((n,x)=>n+BigInt(x.uiTokenAmount.amount),0n);
    const delta = sum(after)-sum(before);
    if (delta===0n) continue;
    const decimals = 9;
    results.push({
      signature: item.signature,
      time: tx.blockTime ? new Date(tx.blockTime*1000).toISOString() : null,
      direction: delta>0n ? "입금" : "출금",
      amount: amount(delta<0n?-delta:delta,decimals),
      note: "Treasury 순잔액 변화 (복합 거래는 순변화량)",
    });
  }
  return { network:"devnet", wallet:treasury, limited:true, transactions:results };
}

function respond(res, status, type, body) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store",
    "x-content-type-options": "nosniff", "access-control-allow-origin": "http://127.0.0.1:" + port });
  res.end(body);
}
const server = http.createServer(async (req, res) => {
  if (req.method !== "GET") return respond(res, 405, "text/plain; charset=utf-8", "Method not allowed");
  try {
    const path = (req.url || "/").split("?")[0];
    if (path === "/api/wallet" ) {
      const address = new URL(req.url, "http://127.0.0.1").searchParams.get("address") || "";
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return respond(res, 400, "application/json; charset=utf-8", JSON.stringify({error:"Invalid Solana public address"}));
      const [sol, tokens] = await Promise.all([
        rpc("getBalance", [address, {commitment:"confirmed"}]),
        rpc("getTokenAccountsByOwner", [address, {mint:MINT}, {encoding:"jsonParsed",commitment:"confirmed"}])
      ]);
      const total = tokens.value.reduce((n, t) => n + BigInt(t.account.data.parsed.info.tokenAmount.amount), 0n);
      return respond(res, 200, "application/json; charset=utf-8", JSON.stringify({
        network:"devnet", address, mint:MINT, solLamports:String(sol.value),
        shahRaw:String(total), shah:amount(total,9), tokenAccounts:tokens.value.length,
        checkedAt:new Date().toISOString()
      }));
    }
    if (path === "/api/transfers") return respond(res, 200, "application/json; charset=utf-8", JSON.stringify(await recentTransfers()));
    if (path === "/api/status") return respond(res, 200, "application/json; charset=utf-8", JSON.stringify(await balances()));
    if (path === "/api/ledger") return respond(res, 200, "text/csv; charset=utf-8", await readFile(join(root, "docs", "devnet-transfer-log.csv"), "utf8"));
    if (path === "/wallet.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "wallet.js"), "utf8"));
    if (path === "/" || path === "/index.html") return respond(res, 200, "text/html; charset=utf-8", await readFile(join(here, "index.html"), "utf8"));
    return respond(res, 404, "text/plain; charset=utf-8", "Not found");
  } catch (error) {
    console.error(error);
    respond(res, 502, "application/json; charset=utf-8", JSON.stringify({ error: error.message || "Unknown error" }));
  }
});
server.listen(port, "127.0.0.1", () => console.log("SHAH CAT Dashboard: http://127.0.0.1:" + port));
