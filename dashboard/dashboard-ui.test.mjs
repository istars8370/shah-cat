// Offline Dashboard clipboard UX regressions; no extension, RPC, signing or transfers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ShahCat from "./shared.js";

const script = readFileSync(new URL("./dashboard-ui.js", import.meta.url), "utf8");
const A = "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const B = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const pending = [];
  const observes = new Map();
  const elements = new Map();
  for (const id of ["walletAddress", "walletState", "copyWallet", "copyMint", "copyMessage"]) {
    elements.set(id, {
      textContent: "", dataset: {}, disabled: false, title: "",
      handlers: {},
      addEventListener(event, handler) { this.handlers[event] = handler; },
    });
  }
  const get = id => elements.get(id) || null;
  get("walletAddress").textContent = A;
  const document = {
    title: "",
    getElementById: get,
    querySelectorAll: () => [],
  };
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(node) { observes.set(node, this.callback); }
  }
  const navigator = {
    clipboard: {
      writeText(address) {
        return new Promise((resolve, reject) => pending.push({ address, resolve, reject }));
      },
    },
  };
  vm.runInNewContext(script, {
    ShahCat, document, navigator, MutationObserver: FakeMutationObserver,
    window: { addEventListener() {} }, location: { hash: "" },
    encodeURIComponent,
  });
  const click = id => get(id).handlers.click();
  const changeAddress = address => {
    get("walletAddress").textContent = address;
    observes.get(get("walletAddress"))();
  };
  return { get, click, changeAddress, pending };
}

test("successful wallet copy reports the copied full address only after clipboard resolves", async () => {
  const w = fixture();
  w.click("copyWallet");
  assert.equal(w.pending[0].address, A);
  assert.equal(w.get("copyMessage").dataset.state, "pending");
  w.pending[0].resolve();
  await flush();
  assert.equal(w.get("copyMessage").dataset.state, "success");
  assert.match(w.get("copyMessage").textContent, /지갑 전체 주소를 복사했습니다/);
});

for (const address of ["연결 안 됨", B]) {
  test("pending wallet copy cannot show success after address changes to " + address, async () => {
    const w = fixture();
    w.click("copyWallet");
    w.changeAddress(address);
    assert.equal(w.get("copyMessage").dataset.state, "warning");
    assert.match(w.get("copyMessage").textContent, /지갑이 변경/);
    w.pending[0].resolve();
    await flush();
    assert.equal(w.get("copyMessage").dataset.state, "warning");
    assert.doesNotMatch(w.get("copyMessage").textContent, /복사했습니다/);
  });
}

test("an older clipboard success cannot overwrite a newer copy result", async () => {
  const w = fixture();
  w.click("copyWallet");
  w.click("copyMint");
  assert.equal(w.pending[1].address, ShahCat.MINT);
  w.pending[1].resolve();
  await flush();
  assert.equal(w.get("copyMessage").dataset.state, "success");
  assert.match(w.get("copyMessage").textContent, /Mint 전체 주소/);
  w.pending[0].resolve();
  await flush();
  assert.match(w.get("copyMessage").textContent, /Mint 전체 주소/);
});

test("an older clipboard rejection cannot overwrite a newer success", async () => {
  const w = fixture();
  w.click("copyWallet");
  w.click("copyMint");
  w.pending[1].resolve();
  await flush();
  w.pending[0].reject(Error("Clipboard permission was denied"));
  await flush();
  assert.equal(w.get("copyMessage").dataset.state, "success");
  assert.match(w.get("copyMessage").textContent, /Mint 전체 주소/);
});

test("Mint copy is independent of a Devnet wallet disconnect", async () => {
  const w = fixture();
  w.click("copyMint");
  w.changeAddress("연결 안 됨");
  assert.equal(w.get("copyMessage").dataset.state, "pending");
  w.pending[0].resolve();
  await flush();
  assert.equal(w.get("copyMessage").dataset.state, "success");
  assert.match(w.get("copyMessage").textContent, /Mint 전체 주소/);
});

test("clipboard errors and missing wallets fail visibly without signaling success", async () => {
  const w = fixture();
  w.click("copyWallet");
  w.pending[0].reject(Error("Denied"));
  await flush();
  assert.equal(w.get("copyMessage").dataset.state, "warning");
  w.changeAddress("연결 안 됨");
  w.click("copyWallet");
  assert.equal(w.get("copyMessage").dataset.state, "warning");
  assert.match(w.get("copyMessage").textContent, /복사할 주소가 없습니다/);
  assert.equal(w.pending.length, 1);
});
