// Offline smoke tests for the committed, read-only SHAH CAT dashboard.
// No external RPC, wallet permissions, signatures, or token transfers.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
let child;
let base;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [join(here, 'server.mjs')], {
    env: { ...process.env, PORT: String(port), SOLANA_RPC_URL: 'http://127.0.0.1:1' },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('Dashboard process exited before startup');
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(350) });
      if (response.ok) return;
    } catch { /* server not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Dashboard did not become ready');
});

after(() => { child?.kill(); });

test('root serves the SHAH CAT HTML dashboard', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/i);
  assert.match(await response.text(), /SHAH CAT/);
});

test('index.html serves the same dashboard', async () => {
  const response = await fetch(`${base}/index.html`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /SHAH CAT/);
});

test('wallet configuration and discovery scripts are served locally in dependency order', async () => {
  const html = await (await fetch(base)).text();
  const paths = ['/project-config.js', '/shared.js', '/wallet-connectors.js', '/wallet.js'];
  let previous = -1;
  for (const path of paths) {
    const position = html.indexOf(`src="${path}"`);
    assert.ok(position > previous, `${path} must load after its dependencies`);
    previous = position;
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') ?? '', /javascript/i);
    assert.ok((await response.text()).trim().length > 0);
  }
  assert.match(html, /id="walletSelect"/);
  assert.match(html, /id="walletAccountSelect"/);
});

test('CSV ledger is served read-only', async () => {
  const response = await fetch(`${base}/api/ledger`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/csv/i);
  assert.ok((await response.text()).trim().length > 0);
});

test('non-GET requests are rejected', async () => {
  const response = await fetch(`${base}/api/status`, { method: 'POST' });
  assert.equal(response.status, 405);
});

test('unknown paths return 404 without RPC access', async () => {
  const response = await fetch(`${base}/definitely-not-an-endpoint`);
  assert.equal(response.status, 404);
});

test('responses disable caching and sniffing', async () => {
  const response = await fetch(base);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});



test('spawned dashboard server opens SHAH Wallet 1.1 on the same port and links back', async () => {
  const dashboard = await fetch(base+'/dashboard');
  assert.equal(dashboard.status,200);
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /href="\/wallet"/);
  assert.match(dashboardHtml, /id="multichain-section"/);
  const wallet = await fetch(base+'/wallet');
  assert.equal(wallet.status,200);
  assert.match(wallet.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  assert.match(wallet.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  const walletHtml = await wallet.text();
  assert.match(walletHtml, /SHAH Wallet/);
  assert.match(walletHtml, /href="\/dashboard"/);
  assert.match(walletHtml, /sendDisabled"[^>]*disabled/);
});

test('spawned dashboard serves the shared Mainnet allowlist, scripts and assets', async () => {
  for(const name of ['/multichain-registry.js','/multichain-ui.js','/dashboard-multichain.js','/wallet-v1.js','/wallet-v1.css']){
    const response=await fetch(base+name);
    assert.equal(response.status,200,name);
    assert.ok((await response.text()).length>100,name);
  }
  const logo=await fetch(base+'/logo.png');
  assert.equal(logo.status,200);
  assert.match(logo.headers.get('content-type')??'',/image\/png/);
});

test('spawned dashboard refuses unknown Mainnet chain, invalid wallet history and write methods', async () => {
  const unknown=await fetch(base+'/api/multichain?chain=wrong&address=0x1111111111111111111111111111111111111111');
  assert.equal(unknown.status,400);
  const invalidHistory=await fetch(base+'/api/wallet-history?address=invalid');
  assert.equal(invalidHistory.status,400);
  const unsafe=await fetch(base+'/wallet',{method:'POST'});
  assert.equal(unsafe.status,405);
});
