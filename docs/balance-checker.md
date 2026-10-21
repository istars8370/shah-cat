# SHAH CAT Devnet balance checker

A read-only Node.js script to inspect the SHAH CAT token supply and balances of the listed development and Treasury wallets.

## Requirements
- Node.js 20 or newer
- Internet access to a Solana Devnet RPC endpoint
- No npm install, wallet connection, private key, or paid service required

## Run on Windows
1. Open the SHAH CAT GitHub repository and download/clone it, or open a terminal in an existing local checkout.
2. In Windows PowerShell, from the repository folder, run:

```powershell
node scripts/check-devnet-balances.mjs
```

3. Read the printed supply, development balance, and Treasury balance.

To use a different Devnet RPC endpoint:

```powershell
$env:SOLANA_RPC_URL="https://api.devnet.solana.com"
node scripts/check-devnet-balances.mjs
```

## What the script does
- Calls Solana Devnet `getTokenSupply`
- Calls `getTokenAccountsByOwner` for each public wallet, filtering by SHAH CAT mint
- Sums all token accounts per owner using integer arithmetic
- Prints timestamp and balances

## Limits and safety
- **Read-only**; no transfers, signing, minting, or authority changes.
- Public Devnet RPC endpoints may rate-limit or temporarily fail; retry later if needed.
- Only two configured wallet addresses are included. It is **not** a complete holder report.
- No private keys or recovery phrases are required. Never paste secrets into source code.
- The script has been committed to GitHub but must still be run to confirm live results in the user's environment.
