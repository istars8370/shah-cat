// Devnet balances compared with policy targets. No wallet identity or payment proof.
import ShahCat from "./shared.js";
import Policy from "./tokenomics.js";

function badInput(message) { const error = Error(message); error.status = 400; return error; }
export async function auditAllocations(addresses, query) {
  Policy.assertProfile();
  if (!addresses || typeof addresses !== "object" || Array.isArray(addresses)) throw badInput("Invalid address mapping");
  const ids = new Set(Policy.MEMBERS.map(x => x.id));
  if (Object.keys(addresses).some(id => !ids.has(id))) throw badInput("Unknown allocation member");
  const used = new Set();
  const entries = Policy.MEMBERS.map(item => {
    const input = addresses[item.id] ?? "";
    if (typeof input !== "string" || input.length > 44) throw badInput("Invalid Solana public address");
    const address = input.trim();
    if (address && !ShahCat.isPublicKey(address)) throw badInput("Invalid Solana public address");
    if (address && used.has(address)) throw badInput("Use a different address for each member; one wallet cannot prove multiple allocations");
    if (address) used.add(address);
    return { id: item.id, name: item.name, role: item.role, targetRaw: String(Policy.rawTarget(item.id)),
      address: address || null, identityVerified: false, allocationVerified: false,
      lockVerified: false, status: "unconfigured", heldRaw: null, deltaRaw: null, relation: null, slot: null };
  });
  const result = { policyVersion: Policy.VERSION, network: "devnet", mint: Policy.MINT, decimals: Policy.DECIMALS,
    networkVerified: false, checkedAt: null, supplyRaw: null, supplyMatchesPolicy: null,
    signatureEnabled: false, broadcastingEnabled: false, members: entries };
  if (!used.size) return result;
  if (await query("getGenesisHash", []) !== ShahCat.DEVNET_GENESIS) throw Error("RPC network mismatch: only Solana Devnet is allowed");
  const mint = await query("getAccountInfo", [Policy.MINT, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const parsed = mint?.value?.data?.parsed;
  if (mint?.value?.owner !== ShahCat.TOKEN.programId || parsed?.type !== "mint" ||
      parsed.info?.isInitialized !== true || parsed.info?.decimals !== Policy.DECIMALS) {
    throw Error("Unexpected SHAH mint program or decimals");
  }
  const supply = ShahCat.rawAmount(parsed.info.supply);
  result.networkVerified = true;
  result.supplyRaw = String(supply);
  result.supplyMatchesPolicy = supply === Policy.TOTAL_RAW;
  // Per-address failures remain unknown, never an invented zero balance.
  for (const entry of entries) {
    if (!entry.address) continue;
    try {
      const accounts = await query("getTokenAccountsByOwner", [entry.address, { mint: Policy.MINT },
        { encoding: "jsonParsed", commitment: "confirmed" }]);
      if (!Array.isArray(accounts?.value)) throw Error("Invalid token account response");
      const keys = new Set();
      let held = 0n, frozen = 0n;
      for (const account of accounts.value) {
        const info = account?.account?.data?.parsed;
        if (!ShahCat.isPublicKey(account.pubkey) || keys.has(account.pubkey) ||
            account.account?.owner !== ShahCat.TOKEN.programId || info?.type !== "account" ||
            info.info?.mint !== Policy.MINT || info.info?.owner !== entry.address ||
            info.info?.tokenAmount?.decimals !== Policy.DECIMALS || !["initialized", "frozen"].includes(info.info?.state)) {
          throw Error("Unexpected or duplicate SHAH token account data");
        }
        keys.add(account.pubkey);
        const raw = ShahCat.rawAmount(info.info.tokenAmount.amount);
        held = ShahCat.rawAmount(held + raw);
        if (info.info.state === "frozen") frozen += raw;
      }
      if (held > supply) throw Error("Wallet balance exceeds observed mint supply");
      Object.assign(entry, Policy.difference(entry.id, held), { frozenRaw: String(frozen), status: "observed",
        tokenAccounts: keys.size, slot: Number.isSafeInteger(accounts.context?.slot) ? accounts.context.slot : null });
    } catch (error) {
      entry.status = "error";
      entry.error = error.message || "Balance lookup failed";
    }
  }
  result.checkedAt = new Date().toISOString();
  return result;
}
