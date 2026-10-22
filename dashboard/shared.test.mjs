import test from "node:test";
import assert from "node:assert/strict";
import ShahCat from "./shared.js";

const { isPublicKey, parseAmount, amount, solAmount, rawAmount, format, MAX_RAW } = ShahCat;

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

for (const [decimals, quantity, expectedRaw, maximum, overflow] of [
  [0, "123", 123n, "18446744073709551615", "18446744073709551616"],
  [6, "12.000001", 12000001n, "18446744073709.551615", "18446744073709.551616"],
  [9, "12.000000001", 12000000001n, "18446744073.709551615", "18446744073.709551616"],
  [18, "1.000000000000000001", 1000000000000000001n, "18.446744073709551615", "18.446744073709551616"],
]) {
  test(`${decimals}-decimal token quantities preserve exact raw units and uint64 boundaries`, () => {
    assert.equal(parseAmount(quantity, decimals), expectedRaw);
    assert.equal(amount(expectedRaw, decimals), quantity);
    assert.equal(parseAmount(maximum, decimals), MAX_RAW);
    assert.equal(amount(MAX_RAW, decimals), maximum);
    assert.throws(() => parseAmount(overflow, decimals), /uint64/);
    assert.equal(parseAmount("0", decimals), 0n);
    assert.equal(amount(0n, decimals), "0");
    const smallest = decimals ? "0." + "0".repeat(decimals - 1) + "1" : "1";
    assert.equal(parseAmount(smallest, decimals), 1n);
    assert.equal(amount(1n, decimals), smallest);
    assert.throws(() => parseAmount("0." + "0".repeat(decimals) + "1", decimals));
    assert.throws(() => parseAmount("1." + "0".repeat(decimals + 1), decimals));
  });
}

test("amount parsing rejects noncanonical input instead of rounding or coercing", () => {
  for (const value of [null, 1, 1n, "", " ", " 1", "1 ", "1\n", "+1", "-1", "1e3", "1,000", "01", ".1", "1.", "NaN", "Infinity", "1".repeat(41)]) {
    assert.throws(() => parseAmount(value, 6), String(value));
  }
  assert.throws(() => parseAmount("1.0", 0));
  assert.equal(parseAmount("1.250000", 6), 1250000n);
  assert.equal(amount(1250000n, 6), "1.25");
});

test("precision outside the explicit 0-to-18 application policy is rejected", () => {
  for (const decimals of [-1, 19, 255, 6.5, "6", null, NaN, Infinity]) {
    assert.throws(() => parseAmount("1", decimals), /Unsupported decimals/);
    assert.throws(() => amount(1n, decimals), /Unsupported decimals/);
  }
});

test("raw amounts retain uint64 and no-floating-point constraints", () => {
  for (const value of [-1n, MAX_RAW + 1n, "-1", "1.0", "01", "1e3", "18446744073709551616", 1, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => rawAmount(value));
  }
  assert.equal(rawAmount("18446744073709551615"), MAX_RAW);
  assert.equal(rawAmount(0n), 0n);
});

test("SOL formatting always uses nine decimals and never token quantity coercion", () => {
  assert.equal(solAmount(1n), "0.000000001");
  assert.equal(solAmount("5000"), "0.000005");
  assert.equal(solAmount(1000000000n), "1");
  assert.equal(solAmount(MAX_RAW), "18446744073.709551615");
  assert.throws(() => solAmount(1));
  assert.throws(() => solAmount(-1n));
});
