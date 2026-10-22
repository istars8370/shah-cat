import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import config from "./project-config.js";
import ShahCat from "./shared.js";

const configScript = readFileSync(new URL("./project-config.js", import.meta.url), "utf8");
const sharedScript = readFileSync(new URL("./shared.js", import.meta.url), "utf8");
const profile = () => JSON.parse(JSON.stringify(config));
const browserWith = value => {
  const context = vm.createContext({ ShahCatConfig: value });
  vm.runInContext(sharedScript, context);
  return context.ShahCat;
};

test("Node configuration exposes the four frozen project-data groups", () => {
  assert.deepEqual(Object.keys(config).sort(), ["NETWORK", "OWNERS", "PROJECT", "TOKEN"]);
  function assertFrozen(value) {
    if (!value || typeof value !== "object") return;
    assert.ok(Object.isFrozen(value));
    for (const child of Object.values(value)) assertFrozen(child);
  }
  assertFrozen(config);
  assert.throws(() => { config.TOKEN.decimals = 6; }, TypeError);
  assert.throws(() => { config.OWNERS[0].address = config.TOKEN.mint; }, TypeError);
  assert.throws(() => { config.OWNERS.push(config.OWNERS[0]); }, TypeError);
  assert.strictEqual(ShahCat.TOKEN, config.TOKEN);
  assert.strictEqual(ShahCat.PROJECT, config.PROJECT);
  assert.strictEqual(ShahCat.NETWORK, config.NETWORK);
  assert.strictEqual(ShahCat.OWNERS, config.OWNERS);
  assert.equal(ShahCat.MINT, config.TOKEN.mint);
  assert.equal(ShahCat.DECIMALS, config.TOKEN.decimals);
  assert.equal(ShahCat.DEVNET_GENESIS, config.NETWORK.genesisHash);
});

test("classic browser scripts use the same frozen configuration without Node globals", () => {
  const context = vm.createContext({});
  vm.runInContext(configScript + "\n" + sharedScript, context);
  assert.equal(context.ShahCat.MINT, ShahCat.MINT);
  assert.equal(context.ShahCat.parseAmount("1.000000001"), 1000000001n);
  assert.equal(context.ShahCat.solAmount(5000n), "0.000005");
  assert.ok(Object.isFrozen(context.ShahCatConfig));
  assert.ok(Object.isFrozen(context.ShahCatConfig.OWNERS[0]));
});

test("missing browser configuration fails explicitly instead of silently using SHAH defaults", () => {
  assert.throws(() => vm.runInNewContext(sharedScript, {}), /Missing project configuration/);
  assert.throws(() => browserWith(null), /Missing project configuration/);
});

test("another supported Devnet token profile drives defaults while SOL precision stays fixed", () => {
  const changed = profile();
  changed.PROJECT.name = "Sample project";
  changed.PROJECT.symbol = "SAMPLE";
  changed.TOKEN.id = "sample-devnet";
  changed.TOKEN.name = "Sample token";
  changed.TOKEN.symbol = "SAMPLE";
  // A format-valid fixture address; this unit test does not assert mint existence.
  changed.TOKEN.mint = "So11111111111111111111111111111111111111112";
  changed.TOKEN.decimals = 6;
  const shared = browserWith(changed);
  assert.equal(shared.MINT, changed.TOKEN.mint);
  assert.equal(shared.DECIMALS, 6);
  assert.equal(shared.parseAmount("1.000001"), 1000001n);
  assert.equal(shared.amount(1000001n), "1.000001");
  assert.throws(() => shared.parseAmount("0.0000001"));
  assert.equal(shared.solAmount(1000000000n), "1");
  assert.equal(shared.solAmount(5000n), "0.000005");
});

for (const [label, mutate, expected] of [
  ["Mainnet chain", c => { c.NETWORK.chain = "solana:mainnet"; }, /only Solana Devnet/],
  ["Mainnet cluster", c => { c.NETWORK.cluster = "mainnet-beta"; }, /only Solana Devnet/],
  ["foreign genesis hash", c => { c.NETWORK.genesisHash = "mainnet-genesis"; }, /only Solana Devnet/],
  ["Mainnet explorer cluster", c => { c.NETWORK.explorerCluster = "mainnet-beta"; }, /only Solana Devnet/],
  ["Token-2022 program", c => { c.TOKEN.programId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"; }, /only the legacy SPL Token Program/],
  ["unknown token program", c => { c.TOKEN.programId = c.TOKEN.mint; }, /only the legacy SPL Token Program/],
  ["31-byte mint", c => { c.TOKEN.mint = "1".repeat(31); }, /TOKEN.mint/],
  ["unsupported token decimals", c => { c.TOKEN.decimals = 19; }, /Unsupported decimals/],
  ["string token decimals", c => { c.TOKEN.decimals = "9"; }, /Unsupported decimals/],
  ["empty project name", c => { c.PROJECT.name = ""; }, /PROJECT.name/],
  ["missing network", c => { delete c.NETWORK; }, /NETWORK must be an object/],
  ["invalid owner address", c => { c.OWNERS[0].address = "not-a-wallet"; }, /OWNERS.address/],
  ["duplicate wallet role", c => { c.OWNERS[1].role = c.OWNERS[0].role; }, /duplicate operating wallet role/],
  ["missing operating roles", c => { c.OWNERS = []; }, /at least two operating wallet roles/],
]) {
  test(`configuration rejects ${label}`, () => {
    const changed = profile();
    mutate(changed);
    assert.throws(() => browserWith(changed), expected);
  });
}
