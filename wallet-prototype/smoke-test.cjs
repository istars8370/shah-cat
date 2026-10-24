// SHAH Wallet static regression checks. Run: node wallet-prototype/smoke-test.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const required = [
  'SHAH WALLET',
  'SMALL CAT. INFINITE WORLDS.',
  '82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2',
  'https://api.devnet.solana.com',
  "rpc('getBalance'",
  "rpc('getTokenAccountsByOwner'",
  "provider.connect()",
  "provider?.disconnect()",
  "provider.on('accountChanged'",
  'disabled title="Not yet implemented"'
];
for (const item of required) assert.ok(html.includes(item), 'Missing required wallet element: ' + item);
assert.equal((html.match(/src="\.\.\/샤아캣코인도안\.png"/g)||[]).length,2,'Official SHAH logo must be used twice');
assert.ok(fs.existsSync(path.join(__dirname, '..', '샤아캣코인도안.png')), 'Official logo file missing');
assert.ok(!/localStorage|sessionStorage|secretKey|mnemonic|seedPhrase/.test(html), 'Prototype must not store secrets');
console.log('PASS: SHAH Wallet static checks (not browser or RPC integration tests)');
