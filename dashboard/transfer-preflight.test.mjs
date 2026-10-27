import test from "node:test";
import assert from "node:assert/strict";
import ShahCat from "./shared.js";
import { transferReadiness } from "./transfer-preflight.mjs";
import { createRequestHandler } from "./server.mjs";

const A = "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const account = (balance = "2000000000", state = "initialized", overrides = {}) => ({
  pubkey: B,
  account: { owner: ShahCat.TOKEN.programId, data: { parsed: { type: "account", info: {
    owner: A, mint: ShahCat.MINT, state, tokenAmount: { amount: balance, decimals: 9 },
    ...overrides,
  } } } },
});

function mockQuery(override = {}) {
  const calls = [];
  const defaults = {
    getGenesisHash: ShahCat.DEVNET_GENESIS,
    getBalance: { value: 20000000 },
    getTokenAccountsByOwner: { value: [account()] },
  };
  const query = async (method, params) => {
    calls.push({ method, params });
    const value = method in override ? override[method] : defaults[method];
    if (value === undefined) throw Error("Unexpected RPC method: " + method);
    return typeof value === "function" ? value(params) : value;
  };
  return { query, calls };
}
const args = { sender: A, recipient: B, quantity: "1.000000001" };

test("returns an unsigned, no-broadcast Devnet construction candidate", async () => {
  const { query, calls } = mockQuery();
  const v = await transferReadiness(args, query);
  assert.equal(v.network, "devnet");
  assert.equal(v.mint, ShahCat.MINT);
  assert.equal(v.rawAmount, "1000000001");
  assert.equal(v.quantity, "1.000000001");
  assert.equal(v.sourceTokenAccount, B);
  assert.equal(v.signatureEnabled, false);
  assert.equal(v.broadcastingEnabled, false);
  assert.equal(v.eligibleForConstruction, true);
  assert.ok(v.limitations.some(x => /not validated/.test(x)));
  assert.deepEqual(calls.map(x => x.method).sort(), [
    "getBalance", "getGenesisHash", "getTokenAccountsByOwner",
  ].sort());
});
test("checks the genesis hash before reading account balances", async () => {
  const { query, calls } = mockQuery({ getGenesisHash: "mainnet" });
  await assert.rejects(transferReadiness(args, query), /only Solana Devnet/);
  assert.deepEqual(calls.map(x => x.method), ["getGenesisHash"]);
});
for (const [name, values] of [
  ["invalid sender", { sender: "not-a-key" }],
  ["invalid recipient", { recipient: "not-a-key" }],
  ["same wallet", { recipient: A }],
  ["zero", { quantity: "0" }],
  ["negative", { quantity: "-1" }],
  ["too many decimals", { quantity: "1.0000000001" }],
  ["uint64 overflow", { quantity: "18446744073.709551616" }],
]) {
  test("rejects " + name + " without making RPC calls", async () => {
    const { query, calls } = mockQuery();
    await assert.rejects(transferReadiness({ ...args, ...values }, query), x => x.status === 400);
    assert.equal(calls.length, 0);
  });
}
test("rejects too little balance on any single eligible token account", async () => {
  const { query } = mockQuery({ getTokenAccountsByOwner: { value: [
    account("700000000", "initialized"), account("700000000", "initialized"),
  ] } });
  await assert.rejects(transferReadiness({ ...args, quantity: "1" }, query), x => x.status === 409);
});
test("rejects frozen accounts", async () => {
  const { query } = mockQuery({ getTokenAccountsByOwner: { value: [account("9000000000", "frozen")] } });
  await assert.rejects(transferReadiness(args, query), x => x.status === 409);
});
test("rejects low SOL policy balance", async () => {
  const { query } = mockQuery({ getBalance: { value: 9999999 } });
  await assert.rejects(transferReadiness(args, query), /reserve policy/);
});
for(const [name, overrides] of [
  ["wrong owner", {owner:B}],
  ["wrong mint", {mint:B}],
  ["wrong token precision", {tokenAmount:{amount:"1",decimals:6}}],
  ["unknown state", {state:"delegated"}],
]) {
  test("rejects corrupted RPC token account: " + name, async () => {
    const { query } = mockQuery({ getTokenAccountsByOwner: { value: [account("2000000000", "initialized", overrides)] } });
    await assert.rejects(transferReadiness(args, query), /Unexpected|Unknown/);
  });
}
test("rejects unsafe lamport integers", async () => {
  const { query } = mockQuery({ getBalance: { value: Number.MAX_SAFE_INTEGER + 1 } });
  await assert.rejects(transferReadiness(args, query), /Unsafe SOL/);
});
test("read-only preflight route rejects bad input, accepts GET and never signs", async () => {
  const { query, calls } = mockQuery();
  const send = async (url, method="GET") => {
    let code, body;
    await createRequestHandler(query)({url,method},{
      writeHead(status){code=status;},
      end(content){body=content;},
    });
    return {code,body};
  };
  const qs = "?sender="+A+"&recipient="+B+"&amount=1";
  const good=await send("/api/preflight"+qs);
  assert.equal(good.code,200);
  const parsed=JSON.parse(good.body);
  assert.equal(parsed.signatureEnabled,false);
  assert.equal(parsed.broadcastingEnabled,false);
  assert.ok(calls.every(x=>["getGenesisHash","getBalance","getTokenAccountsByOwner"].includes(x.method)));
  assert.equal((await send("/api/preflight"+qs,"POST")).code,405);
  assert.equal((await send("/api/preflight?sender=invalid&recipient="+B+"&amount=1")).code,400);
});
