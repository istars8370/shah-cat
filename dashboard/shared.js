// Shared by classic browser scripts and Node.js; no wallet or network access.
var ShahCat = (() => {
  "use strict";
  const config = typeof module === "object" && module.exports
    ? require("./project-config.js")
    : (typeof ShahCatConfig === "undefined" ? null : ShahCatConfig);
  // These are supported capabilities, not fallback project settings. Keep the
  // Devnet and legacy SPL restrictions even when another project profile is used.
  const SUPPORTED_DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
  const SUPPORTED_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const MAX_DECIMALS = 18; // Explicit application policy; broader precision is unsupported.
  const SOL_DECIMALS = 9;
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

  function assertDecimals(decimals) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
      throw Error("Unsupported decimals: expected an integer from 0 to " + MAX_DECIMALS);
    }
  }

  function assertConfig(value) {
    if (!value || typeof value !== "object") {
      throw Error("Missing project configuration: load project-config.js before shared.js");
    }
    const { PROJECT, NETWORK, TOKEN, OWNERS } = value;
    const group = (item, name) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw Error("Invalid project configuration: " + name + " must be an object");
      }
    };
    const text = (item, name) => {
      if (typeof item !== "string" || !item.trim()) throw Error("Invalid project configuration: " + name);
    };
    group(PROJECT, "PROJECT");
    group(NETWORK, "NETWORK");
    group(TOKEN, "TOKEN");
    for (const key of ["name", "symbol", "tagline", "logoUrl"]) text(PROJECT[key], "PROJECT." + key);
    for (const key of ["label", "rpcUrl", "explorerUrl"]) text(NETWORK[key], "NETWORK." + key);
    if (NETWORK.chain !== "solana:devnet" || NETWORK.cluster !== "devnet" ||
        NETWORK.genesisHash !== SUPPORTED_DEVNET_GENESIS || NETWORK.explorerCluster !== "devnet") {
      throw Error("Invalid project configuration: only Solana Devnet is supported");
    }
    if (TOKEN.programId !== SUPPORTED_TOKEN_PROGRAM) {
      throw Error("Invalid project configuration: only the legacy SPL Token Program is supported");
    }
    for (const key of ["id", "name", "symbol"]) text(TOKEN[key], "TOKEN." + key);
    if (!isPublicKey(TOKEN.mint)) throw Error("Invalid project configuration: TOKEN.mint must be a 32-byte Solana address");
    assertDecimals(TOKEN.decimals);
    if (!Array.isArray(OWNERS) || OWNERS.length < 2) {
      throw Error("Invalid project configuration: at least two operating wallet roles are required");
    }
    const roles = new Set();
    for (const owner of OWNERS) {
      group(owner, "OWNERS entry");
      text(owner.role, "OWNERS.role");
      if (roles.has(owner.role)) throw Error("Invalid project configuration: duplicate operating wallet role");
      roles.add(owner.role);
      if (!isPublicKey(owner.address)) throw Error("Invalid project configuration: OWNERS.address must be a 32-byte Solana address");
    }
  }

  assertConfig(config);
  const { PROJECT, NETWORK, TOKEN, OWNERS } = config;
  const MINT = TOKEN.mint;
  const DECIMALS = TOKEN.decimals;
  const DEVNET_GENESIS = NETWORK.genesisHash;

  function parseAmount(value, decimals = DECIMALS) {
    assertDecimals(decimals);
    // Limit the input before BigInt conversion, reject scientific notation and
    // leading zeros, and never round a quantity to fit the selected mint.
    if (typeof value !== "string" || value.length > 40 || !/^(0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) {
      throw Error("수량은 소수점 " + decimals + "자리 이하의 숫자여야 합니다.");
    }
    const [whole, fraction = ""] = value.split(".");
    if (fraction.length > decimals) throw Error("수량은 소수점 " + decimals + "자리 이하여야 합니다.");
    return rawAmount(BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, "0") || "0"));
  }

  function amount(raw, decimals = DECIMALS) {
    assertDecimals(decimals);
    const s = rawAmount(raw).toString().padStart(decimals + 1, "0");
    if (!decimals) return s;
    const fraction = s.slice(-decimals).replace(/0+$/, "");
    return s.slice(0, -decimals) + (fraction ? "." + fraction : "");
  }

  // SOL always has 9 decimals, independent of the selected token profile.
  function solAmount(lamports) {
    return amount(lamports, SOL_DECIMALS);
  }

  function format(value) {
    if (value == null) return "—";
    const text = String(value);
    if (!/^[0-9]+(?:\.[0-9]+)?$/.test(text)) throw Error("Invalid display amount");
    const [whole, fraction] = text.split(".");
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? "." + fraction : "");
  }

  return Object.freeze({
    PROJECT, NETWORK, TOKEN, OWNERS,
    MINT, DECIMALS, DEVNET_GENESIS, MAX_RAW, MAX_DECIMALS, SOL_DECIMALS,
    isPublicKey, rawAmount, parseAmount, amount, solAmount, format,
  });
})();
if (typeof module === "object" && module.exports) module.exports = ShahCat;
