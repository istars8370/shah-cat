// Optional, network-dependent end-to-end smoke test.
// Runs on GitHub-hosted runner against LIVE public read-only Mainnet RPCs.
// Uses ONLY hard-coded public observation addresses, never keys or signing.
// Errors are reported per chain. This is NOT a wallet extension / browser test.
import { readMultiChainBalance } from "./multichain.mjs";

const dummyEvm = "0x000000000000000000000000000000000000dEaD";
const publicSolana = "11111111111111111111111111111111"; // Solana System Program ID
const cases = [
  ["ethereum", dummyEvm, ["ETH", "USDC", "USDT"]],
  ["base", dummyEvm, ["ETH", "USDC"]],
  ["polygon", dummyEvm, ["POL", "USDC"]],
  ["solana-mainnet", publicSolana, ["SOL", "USDC", "USDT"]],
];

let failures = 0;
for (const [chain, address, symbols] of cases) {
  const start = Date.now();
  try {
    const result = await readMultiChainBalance(chain, address);
    if (result.network !== "mainnet" || result.chain !== chain ||
        result.readOnly !== true ||
        result.walletSigningEnabled !== false ||
        result.broadcastingEnabled !== false ||
        result.assets.map(x => x.symbol).join(",") !== symbols.join(",")) {
      throw Error("Unexpected chain, assets, or unsafe capability flag");
    }
    for (const a of result.assets) {
      if (!/^(0|[1-9][0-9]*)$/.test(a.rawAmount) ||
          !/^(0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(a.amount)) {
        throw Error("Invalid amount format: " + a.symbol);
      }
    }
    console.log("PASS "+chain+" "+symbols.join("/")+
      " · "+(Date.now()-start)+"ms · "+
      result.assets.map(a => a.symbol+"="+a.amount).join(", "));
  } catch (error) {
    failures++;
    console.error("FAIL "+chain+" · "+(Date.now()-start)+"ms · "+
      (error?.message || "unknown"));
  }
}
console.log("MAINNET_READONLY_PROBE: "+(cases.length-failures)+"/"+cases.length+" chains passed");
if (failures) process.exitCode = 1;
