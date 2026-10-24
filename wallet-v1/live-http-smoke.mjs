// End-to-end localhost HTTP smoke test for actual SHAH Wallet 1.1 server.
// Public addresses only; no private keys, wallet permission prompts or writes.
import assert from "node:assert/strict";
import http from "node:http";
import { createWalletRequestHandler } from "./server.mjs";

const server = http.createServer(createWalletRequestHandler());
const close = () => new Promise(resolve => server.close(resolve));
const dead = "0x000000000000000000000000000000000000dEaD";

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const url = "http://127.0.0.1:" + server.address().port;
  for (const [path, expected] of [
    ["/", "SHAH Wallet"],
    ["/wallet-v1.css", ".multi-panel"],
    ["/wallet-v1.js", "readOnly"],
    ["/wallet-v1-model.js", "validBalance"],
    ["/multichain-registry.js", "solana-mainnet"],
    ["/multichain-ui.js", "eth_requestAccounts"],
    ["/logo.png", null],
    ["/dashboard", "SHAH CAT"],
  ]) {
    const res = await fetch(url+path, {signal:AbortSignal.timeout(20000)});
    assert.equal(res.status, 200, path+" HTTP status");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff",path+" header");
    const bytes=await res.arrayBuffer();
    assert.ok(bytes.byteLength>40,path+" empty");
    if (expected) {
      const body=new TextDecoder().decode(bytes);
      assert.ok(body.includes(expected),path+" missing expected content");
    }
    console.log("PASS HTTP GET "+path+" · "+bytes.byteLength+" bytes");
  }

  // Production handler must reject unsupported networks before reaching any RPC.
  const invalid = await fetch(url+"/api/multichain?chain=unknown&address="+dead,{
    signal:AbortSignal.timeout(20000),
  });
  assert.ok([400,502].includes(invalid.status));
  console.log("PASS invalid chain rejected · HTTP "+invalid.status);

  // Full HTTP route: real Ethereum mainnet chainID, ETH, Circle USDC and Tether USDT.
  const mainnet = await fetch(url+"/api/multichain?"+
    new URLSearchParams({chain:"ethereum",address:dead}),{
      signal:AbortSignal.timeout(60000),
    });
  const data = await mainnet.json();
  assert.equal(mainnet.status,200,JSON.stringify(data));
  assert.equal(data.network,"mainnet");
  assert.equal(data.chain,"ethereum");
  assert.deepEqual(data.assets.map(x=>x.symbol),["ETH","USDC","USDT"]);
  assert.equal(data.readOnly,true);
  assert.equal(data.walletSigningEnabled,false);
  assert.equal(data.broadcastingEnabled,false);
  console.log("PASS LIVE HTTP mainnet read-only route · ETH="+data.assets[0].amount+
    " USDC="+data.assets[1].amount+" USDT="+data.assets[2].amount);

  const denied = await fetch(url+"/api/multichain?chain=ethereum&address="+dead,{
    method:"POST",signal:AbortSignal.timeout(10000),
  });
  assert.equal(denied.status,405);
  console.log("PASS HTTP POST rejected · 405");
  console.log("WALLET_LIVE_HTTP_PROBE: PASS");
} finally {
  await close();
}
