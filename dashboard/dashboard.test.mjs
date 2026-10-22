import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { balances } from "./server.mjs";
import ShahCat from "./shared.js";

const sharedScript = readFileSync(new URL("./shared.js", import.meta.url), "utf8");
const configScript = readFileSync(new URL("./project-config.js", import.meta.url), "utf8");
const connectorScript = readFileSync(new URL("./wallet-connectors.js", import.meta.url), "utf8");
const walletScript = readFileSync(new URL("./wallet.js", import.meta.url), "utf8");
const statusScript = readFileSync(new URL("./index.html", import.meta.url), "utf8")
  .match(/<script>([\s\S]*?)<\/script>/)[1];
const A = "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const key = address => ({ toBase58: () => address });
const flush = () => new Promise(resolve => setImmediate(resolve));

function mockDocument() {
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: "", value: "", disabled: false, hidden: false,
      addEventListener(name, listener) { this[name] = listener; },
      replaceChildren() {}, append() {},
    });
    return elements.get(id);
  };
  return { getElementById, createElement: () => ({ append() {} }) };
}

function wallet() {
  const document = mockDocument();
  const events = {};
  const requests = [];
  const clock = { now: Date.now() };
  class WalletDate extends Date { static now() { return clock.now; } }
  const provider = {
    isPhantom: true,
    connect: async () => ({ publicKey: key(A) }),
    disconnect: async () => {},
    on: (name, listener) => { events[name] = listener; },
    signTransaction() { assert.fail("Signing must remain disabled"); },
    signAndSendTransaction() { assert.fail("Transfers must remain disabled"); },
    signMessage() { assert.fail("Message signing must remain disabled"); },
  };
  vm.runInNewContext(configScript + "\n" + sharedScript + "\n" + connectorScript + "\n" + walletScript, {
    document, window: { phantom: { solana: provider } },
    Date: WalletDate,
    fetch: url => {
      assert.match(url, /^\/api\/wallet\?address=/);
      return new Promise((resolve, reject) => requests.push({ url, resolve, reject }));
    },
  });
  const respond = (index, raw, overrides = {}) => requests[index].resolve({
    ok: true,
    json: async () => ({
      network: "devnet", mint: ShahCat.MINT, decimals: ShahCat.DECIMALS,
      address: new URL(requests[index].url, "http://localhost").searchParams.get("address"),
      shahRaw: String(raw), shah: ShahCat.amount(raw), solLamports: "1000000000",
      checkedAt: new Date(clock.now).toISOString(), ...overrides,
    }),
  });
  const el = document.getElementById;
  const validate = () => {
    el("checkSend").click();
    return el("sendMessage").textContent;
  };
  el("sendTo").value = B;
  el("sendAmount").value = "1";
  return { el, events, requests, respond, validate, clock };
}

test("a fetched zero balance reports insufficient funds rather than missing data", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  assert.match(w.validate(), /먼저 지갑 잔액/);
  w.respond(0, 0n);
  await flush();
  assert.equal(w.el("connectedShah").textContent, "0");
  assert.match(w.validate(), /잔액이 부족/);
});

for (const outcome of ["success", "failure"]) {
  test(`late ${outcome} from the old account cannot alter the current balance`, async () => {
    const w = wallet();
    await w.el("connectWallet").click();
    w.events.accountChanged(key(B));
    w.respond(1, 2000000000n);
    await flush();
    if (outcome === "success") w.respond(0, 9000000000n);
    else w.requests[0].reject(Error("old request failed"));
    await flush();
    assert.equal(w.el("walletAddress").textContent, B);
    assert.equal(w.el("connectedShah").textContent, "2");
    assert.match(w.el("walletBalanceMessage").textContent, /확인 완료/);
    w.el("sendTo").value = A;
    assert.match(w.validate(), /입력 검증 통과/);
  });
}

test("an old request cannot re-enable the button while the latest request is pending", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  w.events.accountChanged(key(B));
  w.respond(0, 9000000000n);
  await flush();
  assert.equal(w.el("reloadWalletBalance").disabled, true);
  assert.equal(w.el("connectedShah").textContent, "—");
  w.respond(1, 2000000000n);
  await flush();
  assert.equal(w.el("reloadWalletBalance").disabled, false);
});

test("switching A to B and back to A cannot accept the first A request", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  w.events.accountChanged(key(B));
  w.events.accountChanged(key(A));
  w.respond(2, 3000000000n);
  await flush();
  w.respond(0, 9000000000n);
  w.requests[1].reject(Error("old B request failed"));
  await flush();
  assert.equal(w.el("connectedShah").textContent, "3");
  assert.match(w.validate(), /입력 검증 통과/);
});

for (const outcome of ["success", "failure"]) {
  test(`disconnect ignores pending balance ${outcome}`, async () => {
    const w = wallet();
    await w.el("connectWallet").click();
    w.events.disconnect();
    if (outcome === "success") w.respond(0, 9000000000n);
    else w.requests[0].reject(Error("late failure"));
    await flush();
    assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
    assert.equal(w.el("connectedShah").textContent, "—");
    assert.equal(w.el("reloadWalletBalance").disabled, false);
    assert.match(w.el("walletBalanceMessage").textContent, /지갑 연결 후/);
  });
}

for (const field of ["sendTo", "sendAmount"]) {
  test(`editing ${field} invalidates an earlier successful validation`, async () => {
    const w = wallet();
    await w.el("connectWallet").click();
    w.respond(0, 2000000000n);
    await flush();
    assert.match(w.validate(), /입력 검증 통과/);
    w.el(field).value = "invalid";
    w.el(field).input();
    assert.doesNotMatch(w.el("sendMessage").textContent, /입력 검증 통과/);
  });
}

for (const outcome of ["zero", "failure"]) {
  test(`refresh clears old validation and balance before ${outcome}`, async () => {
    const w = wallet();
    await w.el("connectWallet").click();
    w.respond(0, 2000000000n);
    await flush();
    assert.match(w.validate(), /입력 검증 통과/);
    const refresh = w.el("reloadWalletBalance").click();
    assert.doesNotMatch(w.el("sendMessage").textContent, /입력 검증 통과/);
    assert.equal(w.el("connectedShah").textContent, "—");
    assert.match(w.validate(), /먼저 지갑 잔액/);
    if (outcome === "zero") w.respond(1, 0n);
    else w.requests[1].reject(Error("RPC unavailable"));
    await refresh;
    assert.doesNotMatch(w.el("sendMessage").textContent, /입력 검증 통과/);
    assert.equal(w.el("reloadWalletBalance").disabled, false);
    assert.match(w.validate(), outcome === "zero" ? /잔액이 부족/ : /먼저 지갑 잔액/);
  });
}

test("two balance requests for the same account only accept the latest response", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  const refresh = w.el("reloadWalletBalance").click();
  w.respond(1, 2000000000n);
  await refresh;
  w.respond(0, 9000000000n);
  await flush();
  assert.equal(w.el("connectedShah").textContent, "2");
});

function mockRpc(account) {
  return async method => {
    switch (method) {
      case "getGenesisHash": return ShahCat.DEVNET_GENESIS;
      case "getTokenSupply": return { value: { amount: "1000000000", decimals: 9 } };
      case "getTokenAccountsByOwner": return { value: [] };
      case "getAccountInfo": return account;
      default: assert.fail(`Unexpected RPC method: ${method}`);
    }
  };
}

for (const [label, account] of [
  ["missing account", { value: null }],
  ["unparsed data", { value: { data: ["raw", "base64"] } }],
  ["wrong account type", { value: { data: { parsed: { type: "account", info: { mintAuthority: null, freezeAuthority: null } } } } }],
  ["incomplete authority data", { value: { data: { parsed: { type: "mint", info: { mintAuthority: A } } } } }],
]) {
  test(`${label} is marked unverified rather than authority-free`, async () => {
    const result = await balances(mockRpc(account));
    assert.equal(result.authoritiesChecked, false);
  });
}

test("verified null authorities remain distinct from an unavailable lookup", async () => {
  const result = await balances(mockRpc({ value: { data: { parsed: {
    type: "mint", info: { mintAuthority: null, freezeAuthority: null },
  } } } }));
  assert.equal(result.authoritiesChecked, true);
  assert.equal(result.mintAuthority, null);
  assert.equal(result.freezeAuthority, null);
});

test("a retained mint authority and removed freeze authority are preserved", async () => {
  const result = await balances(mockRpc({ value: { data: { parsed: {
    type: "mint", info: { mintAuthority: A, freezeAuthority: null },
  } } } }));
  assert.equal(result.authoritiesChecked, true);
  assert.equal(result.mintAuthority, A);
  assert.equal(result.freezeAuthority, null);
});

test("an RPC failure rejects the status lookup", async () => {
  await assert.rejects(balances(async () => { throw Error("RPC unavailable"); }), /RPC unavailable/);
});

test("status UI distinguishes verified none, unknown data, and refresh failure", async () => {
  const document = mockDocument();
  const el = document.getElementById;
  let data = { authoritiesChecked: true, mintAuthority: A, freezeAuthority: null,
    network: "devnet", mint: ShahCat.MINT, decimals: ShahCat.DECIMALS,
    supply: "1", wallets: [], checkedAt: "2026-10-21T00:00:00Z" };
  let fail = false;
  const context = vm.createContext({
    document,
    fetch: async url => {
      if (url === "/api/ledger") return { ok: true, text: async () => "date_utc,recipient_role,amount,status\n" };
      assert.equal(url, "/api/status");
      if (fail) throw Error("RPC unavailable");
      return { ok: true, json: async () => data };
    },
  });
  vm.runInContext(configScript + "\n" + sharedScript + "\n" + statusScript, context);
  await flush();
  assert.equal(el("mintAuthority").textContent, A);
  assert.equal(el("freezeAuthority").textContent, "없음 (None)");
  data = { ...data, authoritiesChecked: false, mintAuthority: null };
  await context.load();
  assert.equal(el("mintAuthority").textContent, "조회 불가");
  assert.equal(el("freezeAuthority").textContent, "조회 불가");
  assert.match(el("message").textContent, /권한 조회 불가/);
  data = { ...data, authoritiesChecked: true };
  await context.load();
  assert.equal(el("mintAuthority").textContent, "없음");
  fail = true;
  const refresh = context.load();
  assert.equal(el("mintAuthority").textContent, "조회 중");
  await refresh;
  assert.equal(el("mintAuthority").textContent, "조회 불가");
  assert.equal(el("freezeAuthority").textContent, "조회 불가");
  assert.equal(el("refresh").disabled, false);
});

test("invalid base58 byte length cannot pass preview validation", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  w.respond(0, 2000000000n);
  await flush();
  w.el("sendTo").value = "1".repeat(33);
  assert.match(w.validate(), /수신 주소 형식/);
  assert.doesNotMatch(w.el("sendPreview").textContent, /Devnet 전송 미리보기/);
});

for (const overrides of [
  { network: "mainnet-beta" }, { mint: A }, { address: B }, { decimals: 6 },
  { checkedAt: "bad time" }, { checkedAt: "2020-01-01T00:00:00Z" },
  { shahRaw: "-1" }, { shahRaw: String(1n << 64n) }, { solLamports: "1.5" },
]) {
  test(`wallet rejects mismatched or malformed snapshot ${JSON.stringify(overrides)}`, async () => {
    const w = wallet();
    await w.el("connectWallet").click();
    w.respond(0, 2000000000n, overrides);
    await flush();
    assert.match(w.el("walletBalanceMessage").textContent, /조회 실패/);
    assert.equal(w.el("connectedShah").textContent, "—");
    assert.match(w.validate(), /먼저 지갑 잔액/);
  });
}

test("wallet display preserves the smallest unit at billion-token scale", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  w.respond(0, 1000000000000000001n);
  await flush();
  assert.equal(w.el("connectedShah").textContent, "1,000,000,000.000000001");
});

test("preview shows exact values and is cleared on disconnect", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  w.respond(0, 2000000000n);
  await flush();
  w.el("sendAmount").value = "0.000000001";
  assert.match(w.validate(), /입력 검증 통과/);
  assert.match(w.el("sendPreview").textContent, /0\.000000001 SHAH/);
  assert.ok(w.el("sendPreview").textContent.includes(ShahCat.MINT));
  w.events.disconnect();
  assert.doesNotMatch(w.el("sendPreview").textContent, /Devnet 전송 미리보기/);
});

test("validation failure clears an earlier successful preview", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  w.respond(0, 2000000000n);
  await flush();
  assert.match(w.validate(), /입력 검증 통과/);
  w.el("sendAmount").value = "3";
  assert.match(w.validate(), /잔액이 부족/);
  assert.doesNotMatch(w.el("sendPreview").textContent, /Devnet 전송 미리보기/);
});

test("balance older than 60 seconds requires a fresh lookup", async () => {
  const w = wallet();
  await w.el("connectWallet").click();
  w.respond(0, 2000000000n);
  await flush();
  w.clock.now += 60001;
  assert.match(w.validate(), /최신 지갑 잔액/);
  assert.equal(w.el("connectedShah").textContent, "—");
});

for (const [sol, expected] of [["9999999", /실제 수수료 견적은 아닙니다/], ["10000000", /입력 검증 통과/]]) {
  test(`preview SOL threshold: ${sol} lamports`, async () => {
    const w = wallet();
    await w.el("connectWallet").click();
    w.respond(0, 2000000000n, { solLamports: sol });
    await flush();
    assert.match(w.validate(), expected);
  });
}

for (const value of ["0", "-1", "1e3", "01", "0.0000000001", "18446744073.709551616"]) {
  test(`preview rejects invalid or out-of-range quantity ${value}`, async () => {
    const w = wallet();
    await w.el("connectWallet").click();
    w.respond(0, 2000000000n);
    await flush();
    w.el("sendAmount").value = value;
    assert.doesNotMatch(w.validate(), /입력 검증 통과/);
    assert.doesNotMatch(w.el("sendPreview").textContent, /Devnet 전송 미리보기/);
  });
}
