// Read-only SHAH CAT Devnet transfer readiness check.
// No instruction construction, transaction signing, or broadcasting.
import ShahCat from "./shared.js";

const { MINT, DECIMALS, DEVNET_GENESIS, isPublicKey, parseAmount, rawAmount, amount } = ShahCat;
const MIN_SOL_RESERVE_LAMPORTS = 10000000n; // conservative UI policy, not a network fee estimate

function validationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function transferReadiness({ sender, recipient, quantity }, query) {
  if (!isPublicKey(sender) || !isPublicKey(recipient)) {
    throw validationError("Sender and recipient must be valid 32-byte Solana public addresses");
  }
  if (sender === recipient) throw validationError("Sender and recipient must differ");
  let requested;
  try {
    requested = parseAmount(quantity);
  } catch (_) {
    throw validationError("Invalid token amount (up to " + DECIMALS + " fractional digits)");
  }
  if (requested === 0n) throw validationError("SHAH amount must be positive");
  if (typeof query !== "function") throw new Error("Read-only RPC query is required");

  // Fail closed before querying any balances on an unexpected RPC cluster.
  if (await query("getGenesisHash", []) !== DEVNET_GENESIS) {
    throw new Error("RPC network mismatch: only Solana Devnet is allowed");
  }
  const [sol, tokenAccounts] = await Promise.all([
    query("getBalance", [sender, { commitment: "confirmed" }]),
    query("getTokenAccountsByOwner", [sender, { mint: MINT }, {
      encoding: "jsonParsed", commitment: "confirmed",
    }]),
  ]);
  if (!Number.isSafeInteger(sol?.value) || sol.value < 0) {
    throw new Error("Unsafe SOL balance in RPC response");
  }
  if (!Array.isArray(tokenAccounts?.value)) throw new Error("Invalid token account RPC response");
  const spendable = [];
  for (const entry of tokenAccounts.value) {
    const info = entry?.account?.data?.parsed?.info;
    const token = info?.tokenAmount;
    if (!info || !token || token.decimals !== DECIMALS || info.mint !== MINT || info.owner !== sender) {
      throw new Error("Unexpected SHAH token account data");
    }
    const balance = rawAmount(token.amount);
    if (!isPublicKey(entry.pubkey)) throw new Error("Invalid source token account address");
    if (info.state === "initialized") spendable.push({ account: entry.pubkey, balance });
    else if (info.state !== "frozen") throw new Error("Unknown token account state");
  }
  const sufficient = spendable.find(entry => entry.balance >= requested);
  if (!sufficient) {
    throw validationError("No single initialized SHAH token account has enough balance", 409);
  }
  if (BigInt(sol.value) < MIN_SOL_RESERVE_LAMPORTS) {
    throw validationError("Devnet SOL balance below conservative 0.01 SOL reserve policy", 409);
  }
  return {
    network: "devnet", mint: MINT, decimals: DECIMALS,
    sender, recipient, quantity: amount(requested), rawAmount: String(requested),
    sourceTokenAccount: sufficient.account, checkedAt: new Date().toISOString(),
    eligibleForConstruction: true,
    signatureEnabled: false, broadcastingEnabled: false,
    limitations: [
      "Recipient wallet curve and associated token account are not validated",
      "Transaction fee, rent, blockhash and instruction simulation are not calculated",
      "Account balances may change after this snapshot",
      "No signing or token transfer is available in this dashboard",
    ],
  };
}

