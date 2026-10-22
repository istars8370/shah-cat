// Browser-side read-only preflight lifecycle regression tests with mocked Phantom and HTTP.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ShahCat from "./shared.js";

const shared = readFileSync(new URL("./shared.js", import.meta.url), "utf8");
const config = readFileSync(new URL("./project-config.js", import.meta.url), "utf8");
const connectors = readFileSync(new URL("./wallet-connectors.js", import.meta.url), "utf8");
const walletScript = readFileSync(new URL("./wallet.js", import.meta.url), "utf8");
const A = "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const key = value => ({ toBase58: () => value });
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: "", textContent: "", disabled: false, hidden: false,
      addEventListener(event, callback) { this[event] = callback; },
      replaceChildren() {}, append() {},
    });
    return elements.get(id);
  }, createElement() { return {}; } };
  const requests = [];
  const events = {};
  const provider = {
    isPhantom: true,
    connect: async () => ({ publicKey: key(A) }),
    disconnect: async () => {},
    on: (name, fn) => { events[name] = fn; },
    signTransaction() { assert.fail("Must never sign transactions"); },
    signAndSendTransaction() { assert.fail("Must never sign and send"); },
    signMessage() { assert.fail("Must never sign messages"); },
  };
  vm.runInNewContext(config + "\n" + shared + "\n" + connectors + "\n" + walletScript, {
    document, window: { phantom: { solana: provider } },
    URLSearchParams, encodeURIComponent,
    fetch: url => new Promise(resolve => requests.push({ url, resolve })),
  });
  const el = id => document.getElementById(id);
  const walletResponse = (index, overrides = {}) => requests[index].resolve({
    ok: true,
    json: async () => ({
      network:"devnet", mint:ShahCat.MINT, decimals:9,
      address:A, shahRaw:"5000000000", shah:"5", solLamports:"1000000000",
      checkedAt:new Date().toISOString(), ...overrides,
    }),
  });
  const preflightResponse = (index, overrides = {}, ok = true) => requests[index].resolve({
    ok,
    json: async () => ({
      network:"devnet", mint:ShahCat.MINT, decimals:9,
      sender:A, recipient:B, rawAmount:"1000000000", quantity:"1",
      sourceTokenAccount:B, eligibleForConstruction:true,
      signatureEnabled:false, broadcastingEnabled:false,
      checkedAt:new Date().toISOString(), ...overrides,
    }),
  });
  const connected = async () => {
    await el("connectWallet").click();
    assert.match(requests[0].url, /^\/api\/wallet\?address=/);
    walletResponse(0);
    await flush();
    el("sendTo").value = B;
    el("sendAmount").value = "1";
    assert.match((el("checkSend").click(),el("sendMessage").textContent), /입력 검증 통과/);
  };
  return { el, requests, events, connected, walletResponse, preflightResponse };
}

test("read-only onchain button checks eligibility but never prompts Phantom to sign", async () => {
  const w=fixture();
  await w.connected();
  const pending=w.el("checkPreflight").click();
  assert.match(w.requests[1].url, /^\/api\/preflight\?/);
  const search=new URL(w.requests[1].url,"http://127.0.0.1").searchParams;
  assert.equal(search.get("sender"), A);
  assert.equal(search.get("recipient"), B);
  assert.equal(search.get("amount"), "1");
  assert.equal(w.el("checkPreflight").disabled,true);
  w.preflightResponse(1);
  await pending;
  assert.match(w.el("preflightMessage").textContent,/읽기 전용 사전 점검 통과/);
  assert.match(w.el("preflightMessage").textContent,/수신 ATA/);
  assert.equal(w.el("checkPreflight").disabled,false);
});
test("changing quantity invalidates a late onchain preflight response", async () => {
  const w=fixture();await w.connected();
  const pending=w.el("checkPreflight").click();
  w.el("sendAmount").value="2";
  w.el("sendAmount").input();
  w.preflightResponse(1);
  await pending;
  assert.match(w.el("preflightMessage").textContent,/무효화/);
});
test("disconnect invalidates pending onchain response", async () => {
  const w=fixture();await w.connected();
  const pending=w.el("checkPreflight").click();
  await w.el("disconnectWallet").click();
  w.preflightResponse(1);
  await pending;
  assert.match(w.el("preflightMessage").textContent,/무효화/);
  assert.equal(w.el("walletAddress").textContent,"연결 안 됨");
});
test("account switch invalidates prior onchain response", async () => {
  const w=fixture();await w.connected();
  const pending=w.el("checkPreflight").click();
  w.events.accountChanged(key(B));
  w.preflightResponse(1);
  await pending;
  assert.match(w.el("preflightMessage").textContent,/무효화/);
  assert.equal(w.el("walletAddress").textContent,B);
  // Also resolve the new wallet balance request to avoid dangling test state.
  w.walletResponse(2,{address:B});
  await flush();
});
test("invalid Devnet preflight response fails closed", async () => {
  const w=fixture();await w.connected();
  const pending=w.el("checkPreflight").click();
  w.preflightResponse(1,{network:"mainnet-beta"});
  await pending;
  assert.match(w.el("preflightMessage").textContent,/결과 불일치/);
});
test("server 409 means no signed transaction and shows an error", async () => {
  const w=fixture();await w.connected();
  const pending=w.el("checkPreflight").click();
  w.preflightResponse(1,{error:"Frozen source token account"},false);
  await pending;
  assert.match(w.el("preflightMessage").textContent,/Frozen source token account/);
  assert.equal(w.el("checkPreflight").disabled,false);
});

