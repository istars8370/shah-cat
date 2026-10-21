// Shared by classic browser scripts and Node.js; no wallet or network access.
var ShahCat = (() => {
  "use strict";
  const MINT = "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
  const DECIMALS = 9;
  const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
  const MAX_RAW = (1n << 64n) - 1n;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  function isPublicKey(address) {
    if (typeof address !== "string" || address.length < 32 || address.length > 44) return false;
    let value = 0n;
    let leadingZeros = 0;
    for (const char of address) {
      const digit = alphabet.indexOf(char);
      if (digit < 0) return false;
      value = value * 58n + BigInt(digit);
    }
    while (address[leadingZeros] === "1") ++leadingZeros;
    let bytes = leadingZeros;
    while (value > 0n) { ++bytes; value >>= 8n; }
    return bytes === 32;
  }

  function rawAmount(value) {
    if (typeof value !== "bigint" && (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value))) {
      throw Error("Invalid raw token amount");
    }
    const raw = BigInt(value);
    if (raw < 0n || raw > MAX_RAW) throw Error("Token amount exceeds uint64 range");
    return raw;
  }

  function parseAmount(value) {
    if (typeof value !== "string" || value.length > 30 || !/^(0|[1-9][0-9]*)(?:\.[0-9]{1,9})?$/.test(value)) {
      throw Error("수량은 소수점 9자리 이하의 숫자여야 합니다.");
    }
    const [whole, fraction = ""] = value.split(".");
    return rawAmount(BigInt(whole) * 1000000000n + BigInt(fraction.padEnd(DECIMALS, "0")));
  }

  function amount(raw, decimals = DECIMALS) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) throw Error("Unsupported decimals");
    const s = rawAmount(raw).toString().padStart(decimals + 1, "0");
    if (!decimals) return s;
    const fraction = s.slice(-decimals).replace(/0+$/, "");
    return s.slice(0, -decimals) + (fraction ? "." + fraction : "");
  }

  function format(value) {
    if (value == null) return "—";
    const text = String(value);
    if (!/^[0-9]+(?:\.[0-9]+)?$/.test(text)) throw Error("Invalid display amount");
    const [whole, fraction] = text.split(".");
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? "." + fraction : "");
  }

  return Object.freeze({ MINT, DECIMALS, DEVNET_GENESIS, MAX_RAW, isPublicKey, rawAmount, parseAmount, amount, format });
})();
if (typeof module === "object" && module.exports) module.exports = ShahCat;