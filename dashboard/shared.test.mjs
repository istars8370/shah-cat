import test from "node:test";
import assert from "node:assert/strict";
import ShahCat from "./shared.js";

const { isPublicKey, parseAmount, amount, format, MAX_RAW } = ShahCat;

test("known Solana addresses and leading zero byte boundaries", () => {
  for (const value of [ShahCat.MINT, "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs", "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9", "1".repeat(32), "1".repeat(31) + "2"]) {
    assert.equal(isPublicKey(value), true, value);
  }
  for (const value of [null, 32, "", "1".repeat(31), "1".repeat(33), "1".repeat(32) + "2", "z".repeat(44), "0".repeat(32), "O".repeat(32), "I".repeat(32), "l".repeat(32), "1".repeat(32) + "\n"]) {
    assert.equal(isPublicKey(value), false, String(value));
  }
});

test("base58 decoder accepts exactly 32 bytes across generated boundary vectors", () => {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function encode(bytes) {
    let value = BigInt("0x" + Buffer.from(bytes).toString("hex"));
    let result = "";
    while (value > 0n) { result = alphabet[Number(value % 58n)] + result; value /= 58n; }
    for (const byte of bytes) { if (byte !== 0) break; result = "1" + result; }
    return result;
  }
  for (const size of [31, 32, 33]) {
    for (const fill of [0, 1, 127, 255]) assert.equal(isPublicKey(encode(Buffer.alloc(size, fill))), size === 32);
  }
});

test("token amounts round-trip exactly through uint64 boundaries", () => {
  for (const raw of [0n, 1n, 1000000000n, 1000000000000000001n, MAX_RAW]) {
    assert.equal(parseAmount(amount(raw)), raw);
  }
  assert.equal(parseAmount("18446744073.709551615"), MAX_RAW);
  assert.throws(() => parseAmount("18446744073.709551616"));
  assert.equal(amount(123n, 0), "123");
});

test("decimal formatting never inserts separators in the fractional part", () => {
  assert.equal(format("1234.123456789"), "1,234.123456789");
  assert.equal(format(amount(1000000000000000001n)), "1,000,000,000.000000001");
  assert.equal(format(null), "—");
  assert.throws(() => format("NaN"));
});