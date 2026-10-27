# SHAH CAT Four-Way research release candidate v0.1

**Status: RESEARCH PREVIEW ONLY — PRODUCTION NO-GO**

## Scope
- A: off-chain Ed25519 approval evidence and risk-tier policy; Falcon compatibility metadata only
- B: simulated guardian recovery, timelock, freeze and key rotation
- C: versioned module manifest and simulated governance
- D: local hash-chain audit records and externally supplied checkpoint comparison
- Read-only Solana Devnet RPC probe and local Node microbenchmark

## Explicitly absent
- Cryptographically verified Falcon-512/FN-DSA integration for Solana custody
- Authenticated on-chain guardian/governance, persistent nonce, trusted timelock
- Audited SPL vault, real Devnet signing/transfers, production deployment
- Independently anchored audit evidence or external security audit

## Safe review sequence
1. Run `node --test research/four-way/*.test.mjs` on Node 18+ and record exact versions/results.
2. Review each stacked PR in dependency order #27 through #46.
3. Verify all tests, lint, source provenance, dependency licenses and adversarial vectors.
4. Keep research prototype isolated from treasury, wallet and mainnet.
5. Do not release as v1.0 until PR #45 blockers are remediated and independently audited.

This document is a release-readiness inventory, not a launch authorization.
