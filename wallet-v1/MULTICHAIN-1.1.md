# SHAH Wallet 1.1 Multi-chain Preview — read-only

## Staged port, 2026-10-27

Acting owner: Codex in the Wallet/Dashboard work lane. This is the Wallet 1.1
stage of the existing Wallet integration package, scoped to `wallet-v1/` and
`.github/workflows/wallet-v1-regression.yml`.

- Base: PR #87, `4ce795750526cfca2e4c58b3bb7339761e046a41`.
- Source: PR #22, `c05d3e1cabf2231900668e7cfc79b02d5055eea5`, compared with
  PR #20, `76accb296d3e2d200b4457c36ea5b4270a3f66b6`.
- Ports only the standalone Wallet panel, registry, adapter, static routes and
  tests. No old CI replacement, live-RPC workflow or Dashboard file is copied.
- New transport checks bind JSON-RPC version/ID/result to each request, reject
  redirects and unregistered endpoints, and return fixed HTTP error messages.
- PR #23 Dashboard embedding and PR #67 EVM consent race changes are deferred.
  **Known limitation:** a delayed EVM account approval can overwrite a manually
  edited address; stale rejection/button state races also remain pending #67.
  Use manual public-address entry without an outstanding extension prompt.
  This Draft is not ready for runtime release until the follow-up is reviewed.
- PR #80 (`e77602463a19ef7f06acaf4528cf082679b41a91`) and #83
  (`a3f68bb82a3d8bdeeb752ab08489166953e02896`) are separate, unmerged security
  changes. Their files are unchanged by this port; #87 does not contain them.
  A successful Wallet test does not establish their inclusion in this branch.
- SHAH/SOL Devnet remains in the existing Wallet 1.0 panel. Mainnet SOL,
  ETH/POL and issuer-pinned USDC/USDT remain in the separate 1.1 panel.
  Base/Polygon USDT is not added to the original allowlist.

Run `node --test wallet-v1/*.test.mjs` and `node --test dashboard/*.test.mjs`.
Windows sandbox verification may use `--test-isolation=none`; CI runs isolated
Node 22 tests. Actual RPC/explorer comparisons, installed-extension QA and
independent external review remain separate review gates.

### Verification of this port

Code commit: `27d00ba` (subsequent documentation-only commit records this result).
Local runtime: Windows, Node 24.22.1; `--test-isolation=none` used for local tests.

- PASS: Wallet 1.0/1.1 and new security tests: 41/41, fail/skip 0.
- PASS: unchanged Dashboard regression on the PR candidate: 228/228, fail/skip 0.
- PASS: syntax checks for all three new JS modules and `git diff --check`.
- PASS: protected Dashboard, SDK, CI and dependency-guard paths are identical
  to #87. No dependencies or RPC credentials are added by this port.
- PASS: isolated compatibility merge of the code commit with exact #80 and #83
  heads above: no conflicts. Temporary local merge commit
  `9aa74d0b436f621d157aaf7ac73775a3b4891d16` is not pushed into this PR.
- PASS on that compatibility tree: Wallet + Dashboard 308/308; #83 offline
  security suite 239/239; #80 modern SDK fixture suite 3/3. All fail/skip 0.
  Suites overlap and these counts must not be added as unique tests.
- PASS on that compatibility tree: `npm ci --prefix tools/sdk-modern
  --ignore-scripts --no-audit --no-fund`; full development lockfile
  `npm audit --prefix tools/sdk-modern --package-lock-only --json` reports
  0 vulnerabilities. This does not clear B-011 on the unmerged #87 baseline.
- NOT RUN locally: legacy SDK installation on the PR candidate; existing CI
  still tests that baseline. No legacy dependency force-fix was performed.
- NOT RUN: live RPC/explorer comparisons, actual wallet extension consent,
  browser layout QA, independent external audit, signing/transfers/deployment.
- Follow-up remains #23 Dashboard integration and #67 EVM consent races;
  B-012 and production release gates remain open.

> **Security boundary:** SHAH remains a **Solana Devnet token**. This feature also reads balances of **actual-value Mainnet assets** in a visibly separated panel. It **never creates keys, signs, transfers, swaps, bridges, simulates Mainnet transfers or stores wallet secrets**. This PR is stacked on SHAH Wallet 1.0 RC, which must be independently reviewed and merged first. No production release is authorized.

## Initial supported networks

| Network | Native asset | Issuer-pinned tracked tokens | Network proof |
| --- | --- | --- | --- |
| Solana Mainnet Beta | SOL | Circle USDC; Tether USDT | `getGenesisHash` equals Solana mainnet canonical genesis |
| Ethereum Mainnet | ETH | Circle USDC; Tether USDT | `eth_chainId` equals `0x1` |
| Base Mainnet | ETH | Circle USDC | `eth_chainId` equals `0x2105` |
| Polygon PoS Mainnet | POL | Circle USDC | `eth_chainId` equals `0x89` |

**Base USDT, Polygon USDT, bridged USDC.e and arbitrary user-submitted token contracts are intentionally unsupported.** Unsupported assets are not shown as zero; they are not queried. Do not equate USDT or USDC on different chains with the same contract, deposit route or balance.

### Verified identifiers

- Solana USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Solana USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- Ethereum USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Ethereum USDT: `0xdac17f958d2ee523a2206206994597c13d831ec7`
- Base native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Polygon PoS native USDC: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`

Issuer references (last reviewed 2026-10-25):
- [Circle USDC mainnet addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Tether official supported protocols](https://tether.to/en/supported-protocols/)
- [Solana stablecoin mint identifiers](https://solana.com/docs/payments/how-payments-work)
- [Solana mainnet genesis](https://github.com/solana-labs/solana/blob/master/sdk/src/genesis_config.rs)
- [Base JSON RPC chain ID](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId)
- [Polygon Mainnet 137 / POL](https://support.polygon.technology/support/solutions/articles/82000889434-how-to-add-polygon-mainnet-on-metamask-)

## How it works

1. Run Wallet 1.0 standalone server from the root: `node wallet-v1/server.mjs` (defaults to http://127.0.0.1:4184).
2. In **멀티체인 자산 조회**, choose one of four allowlisted Mainnet chains.
3. Paste a **public address**, or for Ethereum/Base/Polygon choose **EVM 지갑 공개 주소 연결** to request **account address disclosure only** via EIP-1193 `eth_requestAccounts`. That approval does **not** sign or transfer anything. No automatic chain switching happens, and the queried EVM chain is selected independently from the extension's current chain.
4. Click **선택 네트워크 잔액 조회**. The backend verifies chain ID or Solana genesis before requesting native and registered token balances. SOL token queries validate mint, legacy token program and decimals. ERC-20 reads invoke only `balanceOf(address)` with function selector `0x70a08231`.
5. The UI presents returned **integer-accurate** balances per network. It refuses mismatched or stale network/address/token/amount replies rather than replacing errors with "0".

The public RPC hosts are currently hard-coded and may throttle or fail; RPC queries reveal the requested public addresses to their providers. This is a local prototype, not a privacy-preserving balance indexer. No market-pricing, total portfolio USD value, asset transfers, Bitcoin/Tron/BSC wallet connection, swaps or bridging yet. Mainnet balance display does not imply SHAH Mainnet launch.

**EVM address check:** This first read-only iteration validates the 20-byte `0x` hexadecimal format, not the EIP-55 mixed-case checksum. Only display and read operations are supported. For future sending, add a dedicated audited checksum and destination verification process.

## Source layout

| File | Purpose |
| --- | --- |
| `wallet-v1/multichain-registry.js` | Immutable chain/asset/issuer allowlist, integer-safe balance rendering |
| `wallet-v1/multichain.mjs` | Server-only fixed-RPC Solana Mainnet and EVM balance adapters |
| `wallet-v1/multichain-ui.js` | Read-only wallet portfolio UI, optional EIP-1193 account consent |
| `wallet-v1/multichain.test.mjs` | Mocked chain/genesis validation, exact asset read calls, no-send tests |
| `wallet-v1/server.mjs` | New GET `/api/multichain?chain=...&address=...` route |
| `wallet-v1/index.html`, `wallet-v1/wallet.css` | Separate Mainnet panel and multi-chain styling |

## Verification & release gates

- GitHub Actions runs existing Dashboard and SDK tests, plus Wallet 1.0 and multi-chain tests.
- **CI mocks do not prove live Mainnet endpoint availability or installed wallet compatibility.** Public RPC rate limits and login/country restrictions may apply.
- Before review completion, manually verify public address read-only balances against official explorers on each chain; verify user permission on MetaMask/EIP-1193, account change and stale responses; assert there is no signing prompt.
- PR 1.0 and PR 1.1 remain Draft and unmerged until user explicitly approves merges.
