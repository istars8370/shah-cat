// SHAH CAT Gate 2: unsigned Devnet-only fee quote and instruction simulation.
// Node.js built-ins only. Never signs, broadcasts, returns transaction bytes, or creates keys.
import { createHash } from "node:crypto";
import ShahCat from "./shared.js";
import { transferReadiness } from "./transfer-preflight.mjs";

const { MINT, DECIMALS, DEVNET_GENESIS, isPublicKey, parseAmount, rawAmount, amount } = ShahCat;
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PDA_MARKER = Buffer.from("ProgramDerivedAddress");
const P = (1n << 255n) - 19n;
const mod = x => ((x % P) + P) % P;
function pow(base, exponent) {
  let result = 1n, value = mod(base);
  while (exponent) {
    if (exponent & 1n) result = mod(result * value);
    value = mod(value * value);
    exponent >>= 1n;
  }
  return result;
}
const D = mod(-121665n * pow(121666n, P - 2n));
const SQRT_MINUS_ONE = pow(2n, (P - 1n) / 4n);
function invalid(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  return error;
}
export function decode58(address) {
  if (!isPublicKey(address)) throw invalid("Invalid 32-byte Solana public address", 400);
  let number = 0n;
  for (const char of address) number = number * 58n + BigInt(BASE58.indexOf(char));
  const bytes = Buffer.alloc(32);
  for (let i = 31; i >= 0 && number > 0n; i--) {
    bytes[i] = Number(number & 255n);
    number >>= 8n;
  }
  return bytes;
}
export function encode58(bytes) {
  const buffer = Buffer.from(bytes);
  let number = 0n;
  for (const b of buffer) number = number * 256n + BigInt(b);
  let chars = "";
  while (number) {
    chars = BASE58[Number(number % 58n)] + chars;
    number /= 58n;
  }
  for (const b of buffer) {
    if (b !== 0) break;
    chars = "1" + chars;
  }
  return chars;
}
// Decode the compressed Edwards-Y representation; matches Solana PDA off-curve rule.
export function isOnCurve(encoded) {
  if (!Buffer.isBuffer(encoded) || encoded.length !== 32) return false;
  const data = Buffer.from(encoded);
  const sign = data[31] >> 7;
  data[31] &= 0x7f;
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(data[i]);
  if (y >= P) return false;
  const y2 = mod(y * y);
  const divisor = mod(D * y2 + 1n);
  if (divisor === 0n) return false;
  const x2 = mod((y2 - 1n) * pow(divisor, P - 2n));
  let x = pow(x2, (P + 3n) / 8n);
  if (mod(x * x) !== x2) x = mod(x * SQRT_MINUS_ONE);
  if (mod(x * x) !== x2) return false;
  if (x === 0n && sign === 1) return false;
  return true;
}
export function deriveAssociatedTokenAddress(wallet, mint = MINT) {
  const owner = decode58(wallet);
  if (!isOnCurve(owner)) throw invalid("Recipient must be an on-curve wallet (PDA recipients disabled)", 400);
  const token = decode58(TOKEN_PROGRAM);
  const mintKey = decode58(mint);
  const program = decode58(ATA_PROGRAM);
  for (let bump = 255; bump >= 0; bump--) {
    const candidate = createHash("sha256")
      .update(Buffer.concat([owner, token, mintKey, Buffer.from([bump]), program, PDA_MARKER]))
      .digest();
    if (!isOnCurve(candidate)) return encode58(candidate);
  }
  throw new Error("Unable to derive recipient associated token account");
}
const key = (pubkey, writable = false, signer = false) => ({ pubkey, writable, signer });
const ix = (programId, keys, data) => ({ programId, keys, data: Buffer.from(data) });
function shortVec(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff) throw Error("Invalid shortvec count");
  const out = [];
  do {
    let chunk = value & 0x7f;
    value >>= 7;
    if (value) chunk |= 0x80;
    out.push(chunk);
  } while (value);
  return Buffer.from(out);
}
export function compileLegacyMessage(payer, blockhash, instructions) {
  if (!instructions.length) throw Error("Empty transaction");
  const map = new Map();
  function add(entry) {
    const prev = map.get(entry.pubkey);
    if (!prev) map.set(entry.pubkey, { ...entry });
    else {
      prev.writable ||= entry.writable;
      prev.signer ||= entry.signer;
    }
  }
  add(key(payer, true, true));
  for (const instruction of instructions) {
    for (const entry of instruction.keys) add(entry);
    add(key(instruction.programId));
  }
  const accounts = [...map.values()];
  // Match the official Solana web3.js legacy compiler's stable ordering:
  // privileges first; same-privilege pubkeys sorted lexicographically.
  // Without the tiebreaker, missing-ATA messages can diverge from the SDK.
  accounts.sort((a, b) => Number(b.signer) - Number(a.signer) ||
    Number(b.writable) - Number(a.writable) ||
    a.pubkey.localeCompare(b.pubkey));
  if (accounts[0]?.pubkey !== payer || accounts.length > 255) throw Error("Unsupported signer or account count");
  const signerCount = accounts.filter(a => a.signer).length;
  if (signerCount !== 1) throw Error("Only one expected unsigned wallet authority");
  const readonlySigned = accounts.filter(a => a.signer && !a.writable).length;
  const readonlyUnsigned = accounts.filter(a => !a.signer && !a.writable).length;
  const index = new Map(accounts.map((entry, i) => [entry.pubkey, i]));
  const blocks = [
    Buffer.from([signerCount, readonlySigned, readonlyUnsigned]),
    shortVec(accounts.length),
    ...accounts.map(entry => decode58(entry.pubkey)),
    decode58(blockhash),
    shortVec(instructions.length),
  ];
  for (const instruction of instructions) {
    blocks.push(Buffer.from([index.get(instruction.programId)]));
    blocks.push(shortVec(instruction.keys.length));
    blocks.push(Buffer.from(instruction.keys.map(a => index.get(a.pubkey))));
    blocks.push(shortVec(instruction.data.length));
    blocks.push(instruction.data);
  }
  return Buffer.concat(blocks);
}
export function unsignedWireTransaction(message) {
  // One placeholder signature, deliberately zeroed (sigVerify:false). No wallet secret.
  return Buffer.concat([shortVec(1), Buffer.alloc(64), message]);
}
function assertTokenAccount(record, wallet, label) {
  if (!record || record.owner !== TOKEN_PROGRAM) throw invalid(label + " must be owned by the legacy SPL Token Program");
  const parsed = record.data?.parsed;
  const info = parsed?.info;
  if (parsed?.type !== "account" || info?.owner !== wallet || info?.mint !== MINT ||
      info?.state !== "initialized" || info?.tokenAmount?.decimals !== DECIMALS) {
    throw invalid(label + " has unexpected mint, owner, state or precision");
  }
}
function amountLamports(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid " + label + " response");
  return BigInt(value);
}
export async function quoteUnsignedTransfer({ sender, recipient, quantity }, query) {
  if (typeof query !== "function") throw Error("RPC query function required");
  const prior = await transferReadiness({ sender, recipient, quantity }, query);
  // This quote exclusively supports classic SPL Token; reject Token-2022 and unknown owners.
  const mintResponse = await query("getAccountInfo", [MINT, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const mintAccount = mintResponse?.value;
  if (mintAccount?.owner !== TOKEN_PROGRAM || mintAccount?.data?.parsed?.type !== "mint" ||
      mintAccount?.data?.parsed?.info?.decimals !== DECIMALS ||
      mintAccount?.data?.parsed?.info?.isInitialized !== true) {
    throw invalid("Mint is not an initialized legacy SPL Token mint with 9 decimals");
  }
  const sourceResponse = await query("getAccountInfo", [
    prior.sourceTokenAccount, { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  assertTokenAccount(sourceResponse?.value, sender, "Source token account");
  const sourceBalance = rawAmount(sourceResponse.value.data.parsed.info.tokenAmount.amount);
  const raw = parseAmount(quantity);
  if (sourceBalance < raw) throw invalid("Source SHAH token account balance changed; retry");

  const ata = deriveAssociatedTokenAddress(recipient);
  const recipientAccount = await query("getAccountInfo", [
    ata, { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const exists = recipientAccount?.value !== null && recipientAccount?.value !== undefined;
  if (exists) assertTokenAccount(recipientAccount.value, recipient, "Recipient ATA");

  const instructions = [];
  if (!exists) {
    // SPL Associated Token Account CreateIdempotent (data [1]).
    instructions.push(ix(ATA_PROGRAM, [
      key(sender, true, true), key(ata, true), key(recipient), key(MINT),
      key(SYSTEM_PROGRAM), key(TOKEN_PROGRAM),
    ], [1]));
  }
  const checked = Buffer.alloc(10);
  checked[0] = 12; // SPL Token TransferChecked instruction discriminant
  checked.writeBigUInt64LE(raw, 1);
  checked[9] = DECIMALS;
  instructions.push(ix(TOKEN_PROGRAM, [
    key(prior.sourceTokenAccount, true), key(MINT), key(ata, true), key(sender, true, true),
  ], checked));

  const latest = await query("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const blockhash = latest?.value?.blockhash;
  if (!isPublicKey(blockhash)) throw new Error("Invalid Devnet blockhash response");
  const message = compileLegacyMessage(sender, blockhash, instructions);
  const fee = await query("getFeeForMessage", [
    message.toString("base64"), { commitment: "confirmed" },
  ]);
  const feeLamports = amountLamports(fee?.value, "network fee");
  let rentLamports = 0n;
  if (!exists) {
    const rent = await query("getMinimumBalanceForRentExemption", [165, { commitment: "confirmed" }]);
    rentLamports = amountLamports(rent, "ATA rent");
  }
  const refreshedSol = await query("getBalance", [sender, { commitment: "confirmed" }]);
  const solBalance = amountLamports(refreshedSol?.value, "SOL balance");
  if (solBalance < feeLamports + rentLamports + 10000000n) {
    throw invalid("Insufficient Devnet SOL for actual message fee, possible ATA rent and 0.01 SOL reserve");
  }
  if (await query("getGenesisHash", []) !== DEVNET_GENESIS) throw Error("RPC cluster changed before simulation");
  const simulation = await query("simulateTransaction", [
    unsignedWireTransaction(message).toString("base64"),
    { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed",
      innerInstructions: false },
  ]);
  if (!simulation?.value || typeof simulation.value !== "object" ||
      Array.isArray(simulation.value) || !Object.hasOwn(simulation.value, "err") ||
      simulation.value.err === undefined) throw Error("Invalid simulation RPC response");
  if (simulation.value.err !== null) throw invalid("Devnet unsigned simulation failed: " + JSON.stringify(simulation.value.err));
  return {
    network: "devnet", mint: MINT, decimals: DECIMALS, sender, recipient,
    rawAmount: String(raw), quantity: amount(raw),
    sourceTokenAccount: prior.sourceTokenAccount,
    recipientAta: ata, recipientAtaExists: exists, requiresAtaCreation: !exists,
    feeLamports: String(feeLamports), feeSol: amount(feeLamports),
    rentLamports: String(rentLamports), rentSol: amount(rentLamports),
    totalPlannedSolLamports: String(feeLamports + rentLamports),
    simulationPassed: true,
    unitsConsumed: Number.isSafeInteger(simulation.value.unitsConsumed) ? simulation.value.unitsConsumed : null,
    checkedAt: new Date().toISOString(), validBlockHeight: latest?.value?.lastValidBlockHeight ?? null,
    signatureEnabled: false, broadcastingEnabled: false,
    limitations: [
      "Unsigned Devnet simulation, not a guaranteed future successful transfer",
      "Quotes and blockhashes expire and balances may change",
      "Priority fees, other token programs and program-derived recipients not supported",
      "No Phantom signing, private keys, token transfers or Mainnet operations",
    ],
  };
}
