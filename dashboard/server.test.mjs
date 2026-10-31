import test from "node:test";
import assert from "node:assert/strict";
import { balances, walletBalance, recentTransfers, automaticLedger, createRequestHandler } from "./server.mjs";
import ShahCat from "./shared.js";

const A = "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const TREASURY = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const token = (raw, decimals = 9) => ({ account: { data: { parsed: { info: {
  tokenAmount: { amount: String(raw), decimals },
} } } } });

function mockQuery(overrides = {}) {
  const calls = [];
  const query = async (method, params) => {
    calls.push({ method, params });
    if (method in overrides) return typeof overrides[method] === "function" ? overrides[method](params) : overrides[method];
    switch (method) {
      case "getGenesisHash": return ShahCat.DEVNET_GENESIS;
      case "getBalance": return { value: 1000000000 };
      case "getTokenSupply": return { value: { decimals: 9, amount: "1000000000000000000" } };
      case "getTokenAccountsByOwner": return { value: [] };
      case "getAccountInfo": return { value: { data: { parsed: { type: "mint", info: { mintAuthority: A, freezeAuthority: null } } } } };
      default: assert.fail(`Unexpected RPC: ${method}`);
    }
  };
  return { query, calls };
}

for (const [label, action] of [["status", query => balances(query)], ["wallet", query => walletBalance(A, query)], ["transfers", query => recentTransfers(query)]]) {
  test(`${label} blocks non-Devnet RPC before reading accounts`, async () => {
    const { query, calls } = mockQuery({ getGenesisHash: "other-cluster" });
    await assert.rejects(action(query), /only Solana Devnet/);
    assert.deepEqual(calls.map(x => x.method), ["getGenesisHash"]);
  });
}

test("malformed addresses are rejected before any RPC call", async () => {
  const { query, calls } = mockQuery();
  await assert.rejects(walletBalance("1".repeat(33), query), error => error.status === 400);
  assert.equal(calls.length, 0);
});

test("wallet aggregates multiple token accounts without losing the smallest unit", async () => {
  const { query } = mockQuery({ getTokenAccountsByOwner: { value: [token(1000000000000000000n), token(1n)] } });
  const result = await walletBalance(A, query);
  assert.equal(result.shah, "1000000000.000000001");
  assert.equal(result.shahRaw, "1000000000000000001");
  assert.equal(result.tokenAccounts, 2);
  assert.equal(result.decimals, 9);
  assert.equal(result.network, "devnet");
});

test("mismatched token precision and unsafe RPC SOL integers fail closed", async () => {
  await assert.rejects(walletBalance(A, mockQuery({ getTokenAccountsByOwner: { value: [token(1n, 6)] } }).query), /decimals mismatch/);
  await assert.rejects(balances(mockQuery({ getTokenSupply: { value: { decimals: 6, amount: "1" } } }).query), /decimals mismatch/);
  await assert.rejects(walletBalance(A, mockQuery({ getBalance: { value: Number.MAX_SAFE_INTEGER + 1 } }).query), /Unsafe SOL/);
});

test("Treasury history deduplicates signatures and skips failed and net-zero transactions", async () => {
  const balance = raw => ({ mint: ShahCat.MINT, owner: TREASURY, uiTokenAmount: { amount: raw, decimals: 9 } });
  const { query, calls } = mockQuery({
    getTokenAccountsByOwner: { value: [{ pubkey: "tokenA" }, { pubkey: "tokenB" }] },
    getSignaturesForAddress: ["in", "out", "zero", "failed"].map((signature, blockTime) => ({ signature, blockTime: blockTime + 1 })),
    getTransaction: ([signature]) => ({ blockTime: 100, meta: {
      err: signature === "failed" ? { error: true } : null,
      preTokenBalances: [balance(signature === "out" ? "2000000000" : "0")],
      postTokenBalances: [balance(signature === "in" ? "1000000000" : "0")],
    } }),
  });
  const result = await recentTransfers(query);
  assert.equal(result.transactions.length, 2);
  assert.ok(result.transactions.some(x => x.direction === "입금" && x.amount === "1"));
  assert.ok(result.transactions.some(x => x.direction === "출금" && x.amount === "2"));
  assert.equal(calls.filter(x => x.method === "getTransaction").length, 4);
  assert.equal(result.limited, true);
});

async function request(url, { method = "GET", query = mockQuery().query, externalFetch = fetch } = {}) {
  let status, headers, body;
  await createRequestHandler(query, externalFetch)({ url, method }, {
    writeHead(s, h) { status = s; headers = h; }, end(value) { body = value; },
  });
  return { status, headers, body };
}


test("automatic ledger accepts only the canonical Devnet SHAH CSV schema", async () => {
  const header = "timestamp_utc,network,token_symbol,mint,transfer_class,sender_role,sender_public_address,recipient_role,recipient_public_address,amount,transaction_signature,slot,status";
  const row = "2026-10-24T03:32:16.000Z,devnet,SHAH," + ShahCat.MINT + ",development_or_other,Development," + A + ",SHAH Treasury," + TREASURY + ",1,sig,1,confirmed";
  const okFetch = async () => ({ ok: true, text: async () => header + "\n" + row + "\n" });
  assert.match(await automaticLedger(okFetch), /,devnet,SHAH,/);

  const wrongMintFetch = async () => ({ ok: true, text: async () => header + "\n" + row.replace(ShahCat.MINT, A) + "\n" });
  await assert.rejects(automaticLedger(wrongMintFetch), /token\/network mismatch/);

  const wrongSchemaFetch = async () => ({ ok: true, text: async () => "bad,header\n" });
  await assert.rejects(automaticLedger(wrongSchemaFetch), /schema mismatch/);
});

test("automatic ledger HTTP route serves validated CSV read-only", async () => {
  const header = "timestamp_utc,network,token_symbol,mint,transfer_class,sender_role,sender_public_address,recipient_role,recipient_public_address,amount,transaction_signature,slot,status";
  const externalFetch = async () => ({ ok: true, text: async () => header + "\n" });
  const result = await request("/api/ledger-auto", { externalFetch });
  assert.equal(result.status, 200);
  assert.match(result.headers["content-type"], /text\/csv/);
  assert.equal(result.body, header + "\n");
});

test("HTTP routes reject invalid addresses, writes, and unknown paths", async t => {
  t.mock.method(console, "error", () => {});
  assert.equal((await request("/api/wallet?address=" + "1".repeat(33))).status, 400);
  assert.equal((await request("/api/status", { method: "POST" })).status, 405);
  assert.equal((await request("/../.git/config")).status, 404);
  const result = await request("/api/status", { query: mockQuery({ getGenesisHash: "wrong" }).query });
  assert.equal(result.status, 502);
  assert.equal(JSON.parse(result.body).error, "Devnet data unavailable or invalid");
});

test("HTTP serves shared code before the wallet script and preserves security headers", async () => {
  const page = await request("/");
  assert.equal(page.status, 200);
  assert.ok(page.body.indexOf('src="/shared.js"') < page.body.indexOf('src="/wallet.js"'));
  assert.equal(page.headers["x-content-type-options"], "nosniff");
  const shared = await request("/shared.js");
  assert.equal(shared.status, 200);
  assert.match(shared.headers["content-type"], /javascript/);
  assert.match(shared.body, /isPublicKey/);
});


test("official project site serves read-only static assets without RPC", async () => {
  const rejectRPC = async () => { throw Error("unexpected RPC"); };
  for(const path of ["/site/","/site/index.html","/site/site.css","/site/site.js","/site/logo.png"]) {
    const response = await request(path,{query:rejectRPC});
    assert.equal(response.status,200,path);
  }
  const page = await request("/site/");
  assert.match(page.body,/Solana Devnet/);
  assert.match(page.body,/Mainnet/);
  const dashboard = await request("/");
  assert.match(dashboard.body,/href="\/site\/"/);
  assert.match(dashboard.body,/화면 계산 v0\.5/);
});
