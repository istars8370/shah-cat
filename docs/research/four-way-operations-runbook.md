# SHAH CAT Four-Way research operations runbook

## Current operating mode
- Research preview only; no production deployment, custody, treasury transfers or wallet signing.
- GitHub PRs #27–#49 are stacked Draft PRs. Review in dependency order and do not blindly merge the stack.
- PR count is not development completeness.

## Verification checklist
1. Review #45 security blockers and confirm release NO-GO.
2. Run GitHub Actions Four-Way research unit tests and capture run URL, exact commit and Node version.
3. Run local `node --test research/four-way/*.test.mjs` and fix failures before marking tests passing.
4. Review code and dependencies, especially Falcon legacy profile and format separation.
5. Require a separately audited on-chain program, authenticated guardians, trusted clock and persistent nonce.
6. Obtain independently verified Solana Devnet receipts and compute/fee measurements.
7. Publish external audit scope, findings and remediation evidence before any mainnet or public quantum-safe claim.

## Rollback / incident handling
- Do not connect research prototype to treasury or wallet.
- If an unsafe integration is proposed, block merge, disable any experimental deployment and review permissions.
- Never publish private keys, seed phrases, RPC credentials or signer material in GitHub.
- Use a new, separately reviewed deployment proposal for any real program.

## Status
Production release: BLOCKED. No live Devnet transaction evidence or external audit attached.
