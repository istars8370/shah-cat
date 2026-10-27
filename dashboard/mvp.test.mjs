import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createRequestHandler } from "./server.mjs";
import { createMonoRunSession } from "./mono-run.mjs";
import { createServer } from "node:http";

const result = (id, extra = {}) => ({ version: 1, sessionId: id, score: 120, durationMs: 30000, ...extra });
test("guest contract strips wallet/reward payloads and consumes results once", () => {
  const session = createMonoRunSession("test-1");
  assert.deepEqual(session.context, { version: 1, game: "mono-run", sessionId: "test-1", mode: "guest", rewardsEnabled: false });
  const receipt = session.finish(result("test-1", { address: "ignored", rewardsEnabled: true, verified: true }));
  assert.equal(receipt.rewardsEnabled, false);
  assert.equal(receipt.verified, false);
  assert.equal(Object.hasOwn(receipt, "address"), false);
  assert.ok(Object.isFrozen(receipt));
  assert.throws(() => session.finish(result("test-1")), /no longer active/);
});
test("contract rejects wrong sessions, versions, unsafe scores and durations", () => {
  assert.throws(() => createMonoRunSession("<script>"), /Invalid/);
  for (const extra of [{ version: 2 }, { sessionId: "other" }, { score: -1 }, { score: 1.5 },
    { score: NaN }, { score: 1000001 }, { durationMs: Infinity }, { durationMs: -1 }, { durationMs: 3600001 }]) {
    const session = createMonoRunSession("test");
    assert.throws(() => session.finish(result("test", extra)), /Invalid/);
    assert.equal(session.finish(result("test")).score, 120);
  }
  const old = createMonoRunSession("old");
  old.dispose();
  assert.throws(() => old.finish(result("old")), /no longer active/);
});
test("UI supports start, finish, restart and disposal without wallet or network globals", async () => {
  const nodes = Object.fromEntries(["monoStart", "monoFinish", "monoStatus"].map(id => [id,
    { disabled: id === "monoFinish", textContent: "", addEventListener(_, fn) { this.click = fn; } }]));
  const lifecycle = {};
  let id = 0;
  const source = (await readFile(new URL("./mvp-ui.mjs", import.meta.url), "utf8")).replace(/^import[^\n]+\n/, "");
  vm.runInNewContext(source, { createMonoRunSession,
    document: { getElementById: id => nodes[id] }, crypto: { randomUUID: () => "session-" + ++id },
    window: { addEventListener: (event, fn) => { lifecycle[event] = fn; } } });
  nodes.monoStart.click();
  assert.equal(nodes.monoFinish.disabled, false);
  nodes.monoFinish.click();
  assert.match(nodes.monoStatus.textContent, /120점 \/ 30초.*보상 없음/);
  assert.equal(nodes.monoFinish.disabled, true);
  nodes.monoStart.click();
  assert.equal(nodes.monoFinish.disabled, false);
  lifecycle.pagehide();
  assert.equal(nodes.monoFinish.disabled, true);
  assert.match(nodes.monoStatus.textContent, /세션이 종료/);
  nodes.monoFinish.click();
  assert.match(nodes.monoStatus.textContent, /세션이 종료/);
  nodes.monoStart.click();
  nodes.monoFinish.click();
  assert.match(nodes.monoStatus.textContent, /120점/);
});

test("Treasury refresh clears stale rows and rejects mismatched or partial responses", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const source = html.slice(html.indexOf("async function loadTransfers(){"),
    html.indexOf('el("reloadTransfers").addEventListener'));
  const treasury = "expected-treasury";
  const valid = { network: "devnet", wallet: treasury, transactions: [
    { time: null, direction: "입금", amount: "1", signature: "example", status: "confirmed" },
  ] };
  let reply = valid;
  let fetchError = false;
  const nodes = Object.fromEntries(["reloadTransfers", "transferMessage", "transfers"].map(id => [id,
    { disabled: false, textContent: "", children: [], replaceChildren() { this.children = []; },
      append(...children) { this.children.push(...children); } }]));
  const makeNode = () => ({ textContent: "", children: [], append(...children) { this.children.push(...children); } });
  const context = vm.createContext({ el: id => nodes[id],
    document: { createElement: makeNode }, format: value => {
      if (!/^\d+$/.test(value)) throw Error("Invalid display amount");
      return value;
    }, ShahCat: { NETWORK: { cluster: "devnet", explorerUrl: "https://explorer.solana.com", explorerCluster: "devnet" },
      OWNERS: [{}, { address: treasury }], TOKEN: { symbol: "SHAH" } },
    fetch: async () => {
      assert.equal(nodes.transfers.children.length, 0, "clear previous history before request");
      if (fetchError) throw Error("RPC unavailable");
      return { ok: true, json: async () => reply };
    } });
  vm.runInContext(source, context);
  await context.loadTransfers();
  assert.equal(nodes.transfers.children.length, 1);
  assert.match(nodes.transfers.children[0].children[3].children[0].textContent, /confirmed/);
  for (const invalid of [{ ...valid, network: "mainnet-beta" }, { ...valid, wallet: "other" },
    { ...valid, transactions: null }, null,
    { ...valid, transactions: [...valid.transactions, { ...valid.transactions[0], amount: "invalid" }] }]) {
    reply = valid;
    await context.loadTransfers();
    reply = invalid;
    await context.loadTransfers();
    assert.equal(nodes.transfers.children.length, 0);
    assert.match(nodes.transferMessage.textContent, /거래 조회 실패/);
    assert.equal(nodes.reloadTransfers.disabled, false);
  }
  reply = valid;
  await context.loadTransfers();
  fetchError = true;
  await context.loadTransfers();
  assert.equal(nodes.transfers.children.length, 0);
  assert.match(nodes.transferMessage.textContent, /RPC unavailable/);
  assert.equal(nodes.reloadTransfers.disabled, false);
});
test("only allowlisted MVP modules are served; mutation does not invoke RPC", async () => {
  const handler = createRequestHandler(() => assert.fail("Unexpected RPC"), () => assert.fail("Unexpected network"));
  async function request(url, method = "GET") {
    const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
    await handler({ url, method }, response);
    return response;
  }
  for (const path of ["/mono-run.mjs", "/mvp-ui.mjs"]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /javascript/);
    assert.equal((await request(path, "POST")).status, 405);
  }
  assert.equal((await request("/../mono-run.mjs")).status, 404);
});

test("localhost serves the complete MVP module graph without RPC and rejects writes", async () => {
  const server = createServer(createRequestHandler(() => assert.fail("Unexpected RPC"),
    () => assert.fail("Unexpected network")));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /type="module" src="\/mvp-ui.mjs"/);
    assert.match(html, /id="monoStart"/);
    assert.match(html, /id="monoFinish"[^>]*disabled/);
    for (const path of ["/mvp-ui.mjs", "/mono-run.mjs", "/dashboard.css"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), path.endsWith("css") ? /text\/css/ : /javascript/);
      assert.equal((await fetch(base + path, { method: "POST" })).status, 405);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
