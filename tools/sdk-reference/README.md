# Archived Solana SDK reference generator (B-011)

**Historical source only — unsupported / do not run.** The old generator in this directory used `@solana/web3.js` 1.x and `@solana/spl-token` 0.4.x and produced the immutable fixture at `dashboard/fixtures/solana-sdk-reference.json`. Its dependency manifests and lockfile have been removed in PR #79 because their transitive `bigint-buffer` dependency is vulnerable.

For current offline parity testing use the reviewed modern verifier instead:

```sh
npm ci --prefix tools/sdk-modern --ignore-scripts --no-audit --no-fund
npm test --prefix tools/sdk-modern
npm audit --prefix tools/sdk-modern --package-lock-only --audit-level=high
```

The modern verifier checks 38 ATA-owner vectors plus six frozen legacy message and unsigned-wire scenarios, including SPL instruction account and data bytes. The original fixture is retained as a historical, immutable comparison oracle; it is **not** regenerated from a replacement SDK without separate human review. If historical regeneration is necessary, use an isolated and separately approved environment, not normal CI or production.

Neither old nor new fixtures prove arbitrary Token-2022, multisig, signer integrations, real chain transactions or Mainnet release readiness. No keys, signing or broadcasting are involved.
