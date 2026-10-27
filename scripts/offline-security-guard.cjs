// Test tripwire for the curated P0-02 suite, not a security sandbox for hostile code.
// Load before ESM imports; block common network, process and filesystem write APIs.
// Native addons, worker isolates and direct bindings are outside this tripwire.
const { syncBuiltinESMExports } = require('node:module');
const deny = () => { throw new Error('P0-02 offline policy: side effect blocked'); };
globalThis.fetch = deny;
for (const [name, methods] of Object.entries({
  http: ['request', 'get'], https: ['request', 'get'],
  net: ['connect', 'createConnection'], tls: ['connect'], dgram: ['createSocket'],
  dns: ['lookup', 'resolve', 'resolve4', 'resolve6'],
  child_process: ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'],
})) {
  const module = require('node:' + name);
  for (const method of methods) module[method] = deny;
}
require('node:net').Socket.prototype.connect = deny;
const fs = require('node:fs');
for (const method of ['writeFile', 'appendFile', 'truncate', 'unlink', 'rename', 'mkdir', 'rmdir', 'rm', 'copyFile', 'cp', 'symlink', 'link', 'chmod', 'chown']) {
  if (fs[method]) fs[method] = deny;
  if (fs[method + 'Sync']) fs[method + 'Sync'] = deny;
  if (fs.promises[method]) fs.promises[method] = deny;
}
fs.createWriteStream = deny;
for (const name of ['open', 'openSync']) {
  const original = fs[name];
  fs[name] = (path, flags, ...rest) => {
    if (!['r', 'rs', 'sr'].includes(flags)) return deny();
    return original(path, flags, ...rest);
  };
}
const originalOpen = fs.promises.open;
fs.promises.open = (path, flags = 'r', ...rest) => {
  if (!['r', 'rs', 'sr'].includes(flags)) return deny();
  return originalOpen.call(fs.promises, path, flags, ...rest);
};
syncBuiltinESMExports();
