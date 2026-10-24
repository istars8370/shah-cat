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

test('policy preview scripts and empty allocation audit work without RPC access', async () => {
  const html = await (await fetch(base)).text();
  assert.ok(html.indexOf('src="/shared.js"') < html.indexOf('src="/tokenomics.js"'));
  assert.ok(html.indexOf('src="/tokenomics.js"') < html.indexOf('src="/tokenomics-ui.js"'));
  for (const path of ['/tokenomics.js', '/tokenomics-ui.js']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  const response = await fetch(base + '/api/allocations');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.networkVerified, false);
  assert.ok(data.members.every(x => x.heldRaw === null && x.status === 'unconfigured'));
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

