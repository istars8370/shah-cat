// Mocked integration checks only: no extension, RPC, keys, signatures or transfers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ShahCat from "./shared.js";

const scripts = ["project-config.js", "shared.js", "wallet-connectors.js"]
  .map(name => readFileSync(new URL(name, import.meta.url), "utf8")).join("\n");
const uiScript = readFileSync(new URL("wallet.js", import.meta.url), "utf8");
const A = "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const CHAIN = "solana:devnet";
const key = address => ({ toBase58: () => address });
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function bytes(address) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const letter of address) value = value * 58n + BigInt(alphabet.indexOf(letter));
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; --i) { out[i] = Number(value % 256n); value /= 256n; }
  return out;
}
const account = (address, chains = [CHAIN]) => ({
  address, publicKey: bytes(address), chains, features: [], label: address === A ? "개발" : "Treasury",
});

function standard({ name = "Example Wallet", accounts = [account(A)], chains = [CHAIN], connect } = {}) {
  const events = new Set();
  const calls = { connect: 0, disconnect: 0, sign: 0 };
  const rejectSigning = () => { ++calls.sign; throw Error("Signing is forbidden"); };
  const wallet = {
    version: "1.0.0", name, icon: "data:image/svg+xml,", chains, accounts: [],
    features: {
      "standard:connect": { version: "1.0.0", async connect() {
        ++calls.connect;
        if (connect) return connect();
        wallet.accounts = accounts;
        return { accounts };
      } },
      "standard:disconnect": { version: "1.0.0", async disconnect() { ++calls.disconnect; } },
      "standard:events": { version: "1.0.0", on(name, callback) {
        assert.equal(name, "change"); events.add(callback); return () => events.delete(callback);
      } },
      "solana:signTransaction": { version: "1.0.0", signTransaction: rejectSigning },
      "solana:signAndSendTransaction": { version: "1.0.0", signAndSendTransaction: rejectSigning },
      "solana:signMessage": { version: "1.0.0", signMessage: rejectSigning },
    },
  };
  const change = properties => {
    Object.assign(wallet, properties);
    for (const listener of [...events]) listener(properties);
  };
  return { wallet, calls, change };
}
function injected(name, address = A, pending = null) {
  const events = new Map();
  const calls = { connect: 0, disconnect: 0, sign: 0 };
  const rejectSigning = () => { ++calls.sign; throw Error("Signing is forbidden"); };
  const provider = {
    [name === "Phantom" ? "isPhantom" : "isSolflare"]: true,
    publicKey: key(address),
    async connect() { ++calls.connect; return pending ? pending.promise : { publicKey: provider.publicKey }; },
    async disconnect() { ++calls.disconnect; },
    on(name, callback) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(callback); },
    removeListener(name, callback) { events.get(name)?.delete(callback); },
    signTransaction: rejectSigning, signAndSendTransaction: rejectSigning, signMessage: rejectSigning,
  };
  return { provider, calls, emit(name, value) { for (const listener of [...(events.get(name) || [])]) listener(value); } };
}
function host() {
  const listeners = new Map();
  return {
    Event,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    dispatchEvent(event) { for (const listener of [...(listeners.get(event.type) || [])]) listener(event); return true; },
    announce(wallet) {
      let unregister;
      this.dispatchEvent({ type: "wallet-standard:register-wallet", detail: api => { unregister = api.register(wallet); } });
      return unregister;
    },
  };
}
function setup({ standards = [], phantom = null, solflare = null, generic = null, ui = false } = {}) {
  const window = host();
  let api;
  window.addEventListener("wallet-standard:app-ready", event => {
    api = event.detail;
    for (const mock of standards) api.register(mock.wallet);
  });
  if (phantom) window.phantom = { solana: phantom.provider };
  if (solflare) window.solflare = solflare.provider;
  if (generic) window.solana = generic;
  const elements = new Map();
  const element = () => ({
    value: "", textContent: "", hidden: false, disabled: false, children: [],
    addEventListener(name, callback) { this[name] = callback; },
    replaceChildren(...children) { this.children = children; },
    append(child) { this.children.push(child); },
  });
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element,
  };
  const requests = [];
  const context = vm.createContext({ window, document, console, URLSearchParams, encodeURIComponent,
    fetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
  });
  vm.runInContext(scripts + (ui ? "\n" + uiScript : "\nvar registry = ShahCatWallets.createRegistry();"), context);
  const el = id => document.getElementById(id);
  return {
    window, api, el, context, requests,
    registry: context.registry,
    respond(index, address, raw = "2000000000") {
      requests[index].resolve({ ok: true, json: async () => ({
        network: "devnet", mint: ShahCat.MINT, decimals: ShahCat.DECIMALS, address,
        shahRaw: raw, solLamports: "1000000000", checkedAt: new Date().toISOString(),
      }) });
    },
    choose(label) {
      const option = el("walletSelect").children.find(option => option.textContent.includes(label));
      assert.ok(option, "wallet option is detected: " + label);
      el("walletSelect").value = option.value;
      el("walletSelect").change();
    },
  };
}

test("standard discovery works before and after app-ready without auto-connecting", () => {
  const first = standard(), late = standard({ name: "Late Wallet" });
  const w = setup({ standards: [first] });
  assert.equal(w.registry.getWallets().length, 1);
  w.window.announce(late.wallet);
  assert.equal(w.registry.getWallets().length, 2);
  assert.equal(first.calls.connect + late.calls.connect, 0);
});

test("duplicate registration cannot unregister an earlier owner or a later registration", () => {
  const one = standard();
  const w = setup();
  const originalOff = w.api.register(one.wallet);
  const duplicateOff = w.api.register(one.wallet, one.wallet);
  duplicateOff();
  assert.equal(w.registry.getWallets().length, 1);
  originalOff();
  assert.equal(w.registry.getWallets().length, 0);
  w.api.register(one.wallet);
  originalOff();
  assert.equal(w.registry.getWallets().length, 1);
});

test("wallet identity is not its advertised name and generic window.solana is not Phantom", () => {
  const phantom = injected("Phantom");
  const named = standard({ name: "Phantom" });
  const duplicateName = standard({ name: "Phantom" });
  const w = setup({ standards: [named, duplicateName], phantom, generic: phantom.provider });
  assert.equal(w.registry.getWallets().length, 3);
  assert.equal(new Set(w.registry.getWallets().map(wallet => wallet.id)).size, 3);
  const unknown = setup({ generic: { connect() {}, disconnect() {}, on() {} } });
  assert.equal(unknown.registry.getWallets().length, 0);
});

test("standard wallet and account must both support Devnet and public keys must match", async () => {
  const mismatch = { ...account(B), publicKey: bytes(A) };
  const mock = standard({ accounts: [account(B, ["solana:mainnet"]), mismatch, account(A)] });
  const mainnetOnly = standard({ chains: ["solana:mainnet"] });
  const w = setup({ standards: [mock, mainnetOnly] });
  assert.equal(w.registry.getWallets().length, 1);
  const accounts = await w.registry.getWallets()[0].connect();
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].address, A);
  assert.equal(mock.calls.sign, 0);
  mainnetOnly.change({ chains: [CHAIN] });
  assert.equal(w.registry.getWallets().length, 2);
});

test("missing lifecycle events or ambiguous injected flags are not accepted", () => {
  const mock = standard();
  delete mock.wallet.features["standard:events"];
  const unknown = injected("Phantom");
  unknown.provider.isSolflare = true;
  const w = setup({ standards: [mock], generic: unknown.provider });
  assert.equal(w.registry.getWallets().length, 0);
});

test("Phantom and Solflare fallbacks expose only connection/account operations", async () => {
  const phantom = injected("Phantom"), solflare = injected("Solflare", B);
  const w = setup({ phantom, solflare });
  const entries = w.registry.getWallets();
  assert.equal(entries.length, 2);
  assert.equal((await entries[0].connect())[0].address, A);
  assert.equal((await entries[1].connect())[0].address, B);
  await entries[0].disconnect();
  await entries[1].disconnect();
  assert.equal(phantom.calls.sign + solflare.calls.sign, 0);
  assert.equal("signTransaction" in entries[0], false);
});

test("no detected wallet disables connect; late registration makes it available", () => {
  const w = setup({ ui: true });
  assert.equal(w.el("connectWallet").disabled, true);
  assert.match(w.el("walletSelect").children[0].textContent, /찾지 못/);
  const late = standard();
  w.window.announce(late.wallet);
  assert.equal(w.el("connectWallet").disabled, false);
  assert.equal(late.calls.connect, 0);
});

test("late same-name standard registration preserves the selected injected path", () => {
  const phantom = injected("Phantom");
  const w = setup({ ui: true, phantom });
  const chosen = w.el("walletSelect").value;
  w.window.announce(standard({ name: "Phantom" }).wallet);
  assert.equal(w.el("walletSelect").children.length, 2);
  assert.equal(w.el("walletSelect").value, chosen);
});

test("standard account selection refreshes balances and invalidates prior validation", async () => {
  const mock = standard({ accounts: [account(A), account(B)] });
  const w = setup({ ui: true, standards: [mock] });
  await w.el("connectWallet").click();
  assert.equal(w.el("walletAddress").textContent, A);
  assert.equal(w.el("walletAccountField").hidden, false);
  w.respond(0, A); await flush();
  w.el("sendTo").value = B; w.el("sendAmount").value = "1";
  w.el("checkSend").click();
  assert.match(w.el("sendMessage").textContent, /검증 통과/);
  w.el("walletAccountSelect").value = B; w.el("walletAccountSelect").change();
  assert.equal(w.el("walletAddress").textContent, B);
  assert.equal(w.el("connectedShah").textContent, "—");
  assert.match(w.el("sendMessage").textContent, /다시 검증/);
  assert.equal(w.requests.length, 2);
  assert.equal(mock.calls.sign, 0);
});

test("standard chain removal disconnects and a stale balance cannot restore it", async () => {
  const mock = standard();
  const w = setup({ ui: true, standards: [mock] });
  await w.el("connectWallet").click();
  mock.change({ chains: ["solana:mainnet"] });
  w.respond(0, A); await flush();
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
  assert.equal(w.el("connectedShah").textContent, "—");
  assert.equal(w.el("connectWallet").disabled, true);
});

test("unregistering the selected standard wallet invalidates the session", async () => {
  const mock = standard();
  const w = setup({ ui: true });
  const unregister = w.window.announce(mock.wallet);
  await w.el("connectWallet").click();
  unregister();
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
  assert.match(w.el("quoteMessage").textContent, /무효화/);
});

test("a rejected standard connection does not load balances", async () => {
  const mock = standard({ connect: async () => { throw Object.assign(Error("Rejected"), { code: 4001 }); } });
  const w = setup({ ui: true, standards: [mock] });
  await w.el("connectWallet").click();
  assert.equal(w.requests.length, 0);
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
  assert.match(w.el("walletMessage").textContent, /취소/);
  assert.equal(w.el("connectWallet").disabled, false);
});

test("concurrent connect clicks are coalesced and cancellation rejects late success", async () => {
  const later = deferred();
  const mock = standard({ connect: () => later.promise });
  const w = setup({ ui: true, standards: [mock] });
  const first = w.el("connectWallet").click();
  await w.el("connectWallet").click();
  assert.equal(mock.calls.connect, 1);
  await w.el("disconnectWallet").click();
  later.resolve({ accounts: [account(A)] }); await first;
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
  assert.equal(w.requests.length, 0);
  assert.equal(mock.calls.disconnect, 1);
});

test("switching to another wallet ignores the old connection and old account events", async () => {
  const later = deferred();
  const old = standard({ name: "Old Wallet", connect: () => later.promise });
  const next = injected("Solflare", B);
  const w = setup({ ui: true, standards: [old], solflare: next });
  const pending = w.el("connectWallet").click();
  w.choose("Solflare");
  await w.el("connectWallet").click();
  later.resolve({ accounts: [account(A)] }); await pending;
  old.change({ accounts: [] });
  assert.equal(w.el("walletAddress").textContent, B);
  assert.equal(w.requests.length, 1);
  assert.equal(old.calls.disconnect, 0);
  assert.equal(next.calls.sign, 0);
});

test("a newer standard account event wins over an old connect response", async () => {
  const later = deferred();
  const mock = standard({ connect: () => later.promise });
  const w = setup({ ui: true, standards: [mock] });
  const pending = w.el("connectWallet").click();
  mock.change({ accounts: [account(B)] });
  later.resolve({ accounts: [account(A)] }); await pending;
  assert.equal(w.el("walletAddress").textContent, B);
  assert.match(w.requests[0].url, new RegExp(B));
});

test("account revocation during connect cannot be reversed by its late response", async () => {
  const later = deferred();
  const mock = standard({ connect: () => later.promise });
  const w = setup({ ui: true, standards: [mock] });
  const pending = w.el("connectWallet").click();
  mock.change({ accounts: [] });
  later.resolve({ accounts: [account(A)] }); await pending;
  assert.equal(w.requests.length, 0);
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
});

test("Solflare account changes and disconnect invalidate the old read-only state", async () => {
  const solflare = injected("Solflare");
  const w = setup({ ui: true, solflare });
  await w.el("connectWallet").click();
  solflare.emit("accountChanged", key(B));
  assert.equal(w.el("walletAddress").textContent, B);
  assert.equal(w.requests.length, 2);
  solflare.emit("disconnect");
  w.respond(1, B); await flush();
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
  assert.equal(w.el("connectedShah").textContent, "—");
  assert.equal(solflare.calls.sign, 0);
});

test("a standard wallet returning only unsupported accounts fails without RPC", async () => {
  const mock = standard({ accounts: [account(A, ["solana:mainnet"])] });
  const w = setup({ ui: true, standards: [mock] });
  await w.el("connectWallet").click();
  assert.equal(w.requests.length, 0);
  assert.match(w.el("walletMessage").textContent, /Solana Devnet 계정/);
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
});

test("standard events containing only features retain the authorized account snapshot", async () => {
  const mock = standard();
  const w = setup({ ui: true, standards: [mock] });
  await w.el("connectWallet").click();
  mock.change({ features: mock.wallet.features });
  assert.equal(w.el("walletAddress").textContent, A);
  assert.equal(mock.calls.sign, 0);
});

test("re-registering the same wallet cannot start a second unresolved connection", async () => {
  const later = deferred();
  const mock = standard({ connect: () => later.promise });
  const w = setup({ ui: true });
  const unregister = w.window.announce(mock.wallet);
  const originalId = w.el("walletSelect").value;
  const pending = w.el("connectWallet").click();
  unregister();
  w.window.announce(mock.wallet);
  assert.equal(w.el("walletSelect").value, originalId);
  assert.equal(w.el("connectWallet").disabled, true);
  await w.el("connectWallet").click();
  assert.equal(mock.calls.connect, 1);
  later.resolve({ accounts: [account(A)] }); await pending;
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
  assert.equal(w.requests.length, 0);
});

test("Solflare fallback accepts a void connect result and reads its publicKey", async () => {
  const solflare = injected("Solflare", B);
  solflare.provider.connect = async () => { ++solflare.calls.connect; };
  const w = setup({ ui: true, solflare });
  await w.el("connectWallet").click();
  assert.equal(w.el("walletAddress").textContent, B);
  assert.equal(w.requests.length, 1);
  assert.equal(solflare.calls.sign, 0);
});

test("a wallet without optional disconnect is cleared locally without claiming permission revocation", async () => {
  const mock = standard();
  delete mock.wallet.features["standard:disconnect"];
  const w = setup({ ui: true, standards: [mock] });
  await w.el("connectWallet").click();
  await w.el("disconnectWallet").click();
  assert.equal(w.el("walletAddress").textContent, "연결 안 됨");
  assert.match(w.el("walletMessage").textContent, /지갑 앱의 연결 권한/);
});

for (const property of ["features", "chains"]) {
  test(`a compatible ${property}-only event does not revoke a pending connection`, async () => {
    const later = deferred();
    const mock = standard({ connect: () => later.promise });
    const w = setup({ ui: true, standards: [mock] });
    const pending = w.el("connectWallet").click();
    mock.change({ [property]: mock.wallet[property] });
    assert.equal(w.el("disconnectWallet").hidden, false);
    assert.equal(w.el("disconnectWallet").textContent, "연결 취소");
    later.resolve({ accounts: [account(A)] }); await pending;
    assert.equal(w.el("walletAddress").textContent, A);
    assert.equal(w.requests.length, 1);
    assert.equal(mock.calls.disconnect, 0);
  });
}

test("an old Standard disconnect must finish before its injected alias can connect", async () => {
  const release = deferred();
  const phantom = injected("Phantom");
  const mock = standard({ name: "Phantom" });
  mock.wallet.features["standard:disconnect"].disconnect = async () => {
    ++mock.calls.disconnect;
    await release.promise;
    phantom.emit("disconnect");
  };
  const w = setup({ ui: true, standards: [mock], phantom });
  await w.el("connectWallet").click();
  w.choose("확장 연결");
  assert.equal(w.el("connectWallet").disabled, true);
  await w.el("connectWallet").click();
  assert.equal(phantom.calls.connect, 0);
  release.resolve(); await flush();
  assert.equal(w.el("connectWallet").disabled, false);
  await w.el("connectWallet").click();
  assert.equal(phantom.calls.connect, 1);
  assert.equal(w.el("walletAddress").textContent, A);
});

test("late cancelled-connect cleanup also blocks a new alias until disconnect settles", async () => {
  const connection = deferred(), release = deferred();
  const phantom = injected("Phantom");
  const mock = standard({ name: "Phantom", connect: () => connection.promise });
  mock.wallet.features["standard:disconnect"].disconnect = async () => {
    ++mock.calls.disconnect;
    await release.promise;
    phantom.emit("disconnect");
  };
  const w = setup({ ui: true, standards: [mock], phantom });
  const oldConnect = w.el("connectWallet").click();
  await w.el("disconnectWallet").click();
  connection.resolve({ accounts: [account(A)] }); await flush();
  assert.equal(mock.calls.disconnect, 1);
  w.choose("확장 연결");
  assert.equal(w.el("connectWallet").disabled, true);
  await w.el("connectWallet").click();
  assert.equal(phantom.calls.connect, 0);
  release.resolve(); await oldConnect;
  assert.equal(w.el("connectWallet").disabled, false);
  await w.el("connectWallet").click();
  assert.equal(w.el("walletAddress").textContent, A);
  assert.equal(w.requests.length, 1);
});
