// SHAH CAT local dashboard (Node.js 20+; no dependencies).
// Chain APIs are read-only; Treasury policy decisions are stored locally.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import ShahCat from "./shared.js";
import { transferReadiness } from "./transfer-preflight.mjs";
import { quoteUnsignedTransfer } from "./transfer-quote.mjs";
import { auditAllocations } from "./allocation-audit.mjs";
import { treasuryAPI } from "./treasury-api.mjs";
import { airdropAPI } from "./airdrop-api.mjs";
import { createReadOnlyRpc } from "./devnet-rpc.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const port = Number(process.env.PORT || 4173);
const { MINT, DECIMALS, DEVNET_GENESIS, NETWORK, TOKEN, OWNERS, isPublicKey, rawAmount, amount } = ShahCat;
const RPC = process.env.SOLANA_RPC_URL || NETWORK.rpcUrl;
const owners = OWNERS;
const AUTO_LEDGER_URL = "https://raw.githubusercontent.com/istars8370/shah-cat/automation/devnet-ledger-data/docs/devnet-transfer-ledger-auto.csv";
const rpc = createReadOnlyRpc({ url: RPC });
export async function assertDevnet(query = rpc) {
  if (await query("getGenesisHash", []) !== DEVNET_GENESIS) {
    throw Error("RPC network mismatch: only Solana Devnet is allowed");
  }
}
function tokenBalance(accounts) {
  return accounts.reduce((sum, item) => {
    const token = item.account.data.parsed.info.tokenAmount;
    if (token.decimals !== DECIMALS) throw Error("SHAH decimals mismatch");
    return sum + rawAmount(token.amount);
  }, 0n);
}
export async function balances(query = rpc) {
  await assertDevnet(query);
  const supply = await query("getTokenSupply", [MINT, { commitment: "confirmed" }]);
  const decimals = supply.value.decimals;
  if (decimals !== DECIMALS) throw Error("SHAH decimals mismatch");
  const wallets = [];
  for (const wallet of owners) {
    const result = await query("getTokenAccountsByOwner", [
      wallet.address, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" },
    ]);
    const total = tokenBalance(result.value);
    wallets.push({ ...wallet, balance: amount(total, decimals), tokenAccounts: result.value.length });
  }
  const mintInfo = await query("getAccountInfo", [MINT, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const parsed = mintInfo?.value?.data?.parsed;
  const info = parsed?.type === "mint" ? parsed.info : undefined;
  const validAuthority = value => value === null || (typeof value === "string" && value.length > 0);
  const authoritiesChecked = validAuthority(info?.mintAuthority) && validAuthority(info?.freezeAuthority);
  return {
    checkedAt: new Date().toISOString(), network: "devnet", mint: MINT,
    supply: amount(supply.value.amount, decimals), decimals, wallets,
    authoritiesChecked,
    mintAuthority: info?.mintAuthority ?? null,
    freezeAuthority: info?.freezeAuthority ?? null,
  };
}

// Recent on-chain activity for the Treasury's SHAH token accounts (read-only).
export async function recentTransfers(query = rpc) {
  await assertDevnet(query);
  const treasury = owners[1].address;
  const accounts = await query("getTokenAccountsByOwner", [
    treasury, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const addresses = accounts.value.map(x => x.pubkey);
  const signatures = new Map();
  for (const address of addresses) {
    const list = await query("getSignaturesForAddress", [address, { limit: 20, commitment: "confirmed" }]);
    for (const item of list) signatures.set(item.signature, item);
  }
  const latest = [...signatures.values()].sort((x,y)=>(y.blockTime||0)-(x.blockTime||0)).slice(0,20);
  const results = [];
  for (const item of latest) {
    const tx = await query("getTransaction", [item.signature, {
      encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed",
    }]);
    if (!tx?.meta || tx.meta.err) continue;
    const before = tx.meta.preTokenBalances || [];
    const after = tx.meta.postTokenBalances || [];
    const sum = arr => arr.filter(x=>x.mint===MINT && x.owner===treasury)
      .reduce((n,x)=>{
        if (x.uiTokenAmount.decimals !== DECIMALS) throw Error("SHAH decimals mismatch");
        return n + rawAmount(x.uiTokenAmount.amount);
      },0n);
    const delta = sum(after)-sum(before);
    if (delta===0n) continue;
    const decimals = DECIMALS;
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

export async function automaticLedger(fetcher = fetch) {
  const response = await fetcher(AUTO_LEDGER_URL, {
    headers: { "accept": "text/csv,text/plain;q=0.9" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw Error("Automatic ledger HTTP " + response.status);
  const text = await response.text();
  const header = "timestamp_utc,network,token_symbol,mint,transfer_class,sender_role,sender_public_address,recipient_role,recipient_public_address,amount,transaction_signature,slot,status";
  const firstLine = text.split(/\r?\n/, 1)[0];
  if (firstLine !== header) throw Error("Automatic ledger schema mismatch");
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    if (!line.includes("," + NETWORK.cluster + "," + TOKEN.symbol + "," + MINT + ",")) {
      throw Error("Automatic ledger token/network mismatch");
    }
  }
  return text;
}

export async function walletBalance(address, query = rpc) {
  if (!isPublicKey(address)) {
    const error = Error("Invalid Solana public address");
    error.status = 400;
    throw error;
  }
  await assertDevnet(query);
  const [sol, tokens] = await Promise.all([
    query("getBalance", [address, { commitment: "confirmed" }]),
    query("getTokenAccountsByOwner", [address, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" }]),
  ]);
  if (!Number.isSafeInteger(sol.value) || sol.value < 0) throw Error("Unsafe SOL balance in RPC response");
  const total = tokenBalance(tokens.value);
  return {
    network: NETWORK.cluster, address, mint: MINT, decimals: DECIMALS, solLamports: String(sol.value),
    tokenId: TOKEN.id, symbol: TOKEN.symbol, tokenProgram: TOKEN.programId,
    shahRaw: String(total), shah: amount(total), tokenAccounts: tokens.value.length,
    checkedAt: new Date().toISOString(),
  };
}

function respond(res, status, type, body) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store",
    "x-content-type-options": "nosniff", "access-control-allow-origin": "http://127.0.0.1:" + port });
  res.end(body);
}
export function createRequestHandler(query = rpc, externalFetch = fetch, treasuryStore) {
 return async (req, res) => {
  if ((req.url || "").split("?")[0].startsWith("/api/treasury")) {
    try { return await treasuryAPI(req, res, treasuryStore); }
    catch (error) { return respond(res, [400,403,404,409,413,503].includes(error.status) ? error.status : 503, "application/json; charset=utf-8", JSON.stringify({ error: error.status ? error.message : "Treasury 원장 또는 설정을 확인하세요." })); }
  }
  if ((req.url || "").split("?")[0].startsWith("/api/airdrop")) {
    try { return await airdropAPI(req, res); }
    catch (error) { return respond(res, [400,403,404,409,413,503].includes(error.status) ? error.status : 503, "application/json; charset=utf-8", JSON.stringify({ error: error.status ? error.message : "Airdrop 원장 또는 설정을 확인하세요." })); }
  }
  if (req.method !== "GET") return respond(res, 405, "text/plain; charset=utf-8", "Method not allowed");
  try {
    const path = (req.url || "/").split("?")[0];
    if (path === "/api/allocations") {
      const params = new URL(req.url, "http://127.0.0.1").searchParams;
      const addresses = Object.create(null);
      for (const [key, value] of params) {
        if (Object.hasOwn(addresses, key)) { const error = Error("Duplicate allocation parameter"); error.status = 400; throw error; }
        addresses[key] = value;
      }
      return respond(res, 200, "application/json; charset=utf-8", JSON.stringify(await auditAllocations(addresses, query)));
    }
    if (path === "/api/wallet" ) {
      const address = new URL(req.url, "http://127.0.0.1").searchParams.get("address") || "";
      return respond(res, 200, "application/json; charset=utf-8", JSON.stringify(await walletBalance(address, query)));
    }
    if (path === "/api/preflight") {
      const input = new URL(req.url, "http://127.0.0.1");
      const sender = input.searchParams.get("sender") || "";
      const recipient = input.searchParams.get("recipient") || "";
      const quantity = input.searchParams.get("amount") || "";
      return respond(res, 200, "application/json; charset=utf-8",
        JSON.stringify(await transferReadiness({ sender, recipient, quantity }, query)));
    }
    if (path === "/api/quote") {
      const input = new URL(req.url, "http://127.0.0.1");
      const sender = input.searchParams.get("sender") || "";
      const recipient = input.searchParams.get("recipient") || "";
      const quantity = input.searchParams.get("amount") || "";
      return respond(res, 200, "application/json; charset=utf-8",
        JSON.stringify(await quoteUnsignedTransfer({ sender, recipient, quantity }, query)));
    }
    if (path === "/api/transfers") return respond(res, 200, "application/json; charset=utf-8", JSON.stringify(await recentTransfers(query)));
    if (path === "/api/status") return respond(res, 200, "application/json; charset=utf-8", JSON.stringify(await balances(query)));
    if (path === "/api/ledger") return respond(res, 200, "text/csv; charset=utf-8", await readFile(join(root, "docs", "devnet-transfer-log.csv"), "utf8"));
    if (path === "/api/ledger-auto") return respond(res, 200, "text/csv; charset=utf-8", await automaticLedger(externalFetch));
    if (["/treasury.html", "/treasury-ui.js", "/airdrop.html", "/airdrop-ui.js", "/apply.html", "/apply-ui.js"].includes(path)) return respond(res, 200, path.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", await readFile(join(here, path.slice(1)), "utf8"));
    if (path === "/logo.png") return respond(res, 200, "image/png", await readFile(join(root, "샤아캣코인도안.png")));
    if (path === "/dashboard.css") return respond(res, 200, "text/css; charset=utf-8", await readFile(join(here, "dashboard.css"), "utf8"));
    if (path === "/dashboard-ui.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "dashboard-ui.js"), "utf8"));
    if (path === "/project-config.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "project-config.js"), "utf8"));
    if (path === "/wallet-connectors.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "wallet-connectors.js"), "utf8"));
    if (path === "/wallet.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "wallet.js"), "utf8"));
    if (path === "/shared.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "shared.js"), "utf8"));
    if (path === "/tokenomics.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "tokenomics.js"), "utf8"));
    if (path === "/tokenomics-ui.js") return respond(res, 200, "text/javascript; charset=utf-8", await readFile(join(here, "tokenomics-ui.js"), "utf8"));
    if (path === "/" || path === "/index.html") return respond(res, 200, "text/html; charset=utf-8", await readFile(join(here, "index.html"), "utf8"));
    return respond(res, 404, "text/plain; charset=utf-8", "Not found");
  } catch (error) {
    const status = [400, 409].includes(error?.status) ? error.status : 502;
    // Never log exception objects, URLs, request params or upstream payloads.
    const message = status === 400 ? "Invalid request" : status === 409 ?
      "Devnet validation failed" : "Devnet data unavailable or invalid";
    console.error("Dashboard request failed", { status });
    respond(res, status, "application/json; charset=utf-8", JSON.stringify({ error: message }));
  }
 };
}
const server = http.createServer(createRequestHandler());
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, "127.0.0.1", () => console.log("SHAH CAT Dashboard: http://127.0.0.1:" + port));
}
