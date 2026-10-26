# SHAH CAT MVP 1.0 — Integration and Security Gates

Status: PROPOSED / REVIEW ONLY (2026-10-27)

## Scope and safety
- Devnet-only; no Mainnet deployment, DEX liquidity, custody or financial production.
- Never collect secrets, seed phrases, private keys or automatically sign/send transactions.
- Research-only Four-Way, Falcon/PQC and Guardian prototypes must not be wired into production authorization or Treasury execution.
- No automatic merging of stacked PRs; reviewers must inspect dependency order and conflicts.

## Baseline evidence
- main: Dashboard 2.0, tokenomics v0.5, Treasury policy/API/tests, transfer preflight and CI.
- README records a prior Devnet transfer, but dashboard signing and sending remain disabled.
- PR #20 Wallet 1.0, #22 Wallet 1.1, #23 dashboard integration, #26 Gate 3 preparation are open drafts.
- PR #27-#50 Four-Way research, #54-#60 Guardian/Devnet research form stacked review work. PR #50 explicitly states NO-GO production.
- PR #62 clipboard QA depends on #23, not main.

## Ordered gates
### G4-A Inventory and dependency audit
- [ ] Export open PR list, base/head refs, CI status, review state and overlapping files.
- [ ] Identify independently mergeable documentation/QA changes; do not merge until reviewed.
- [ ] Record blockers and owners in an integration decision log.

### G4-B Wallet and Dashboard read-only integration
- [ ] Validate Solana Devnet, Ethereum, Base, Polygon watch-only behavior and supported USDC/USDT contracts by network.
- [ ] Test disconnect, account switch, wrong network, RPC failure, stale responses, invalid input and clipboard races.
- [ ] Run full CI on final candidate merge head, not only child PR heads.

### G4-C Treasury and authorization safety
- [ ] Verify role separation, explicit approval/rejection, immutable audit evidence and replay prevention in deterministic tests.
- [ ] Distinguish UI/API approval records from enforceable on-chain multisig/custody controls.
- [ ] No actual transfer enabled by this gate.

### G4-D Guardian research isolation
- [ ] Review PDA stability, recovery authorization, nonce/replay protection, time boundary tests and adversarial cases.
- [ ] Keep Falcon signature-format incompatibilities blocked until separately reviewed and proven interoperable.
- [ ] Independent security review required before any execution-path integration.

### G4-E Optional Devnet disposable-value experiment (separate authorization)
- [ ] Define disposable Devnet wallet, amount cap, destination and network confirmation.
- [ ] Simulate unsigned transaction, fees, rent and recipient ATA creation before any prompt.
- [ ] Require explicit human approval for each signature; reconcile chain receipt and ledger.
- [ ] Reject wrong network, stale wallet, duplicate intent, timeout and user cancellation.

### G4-F MVP release decision
- [ ] CI and regression tests pass on candidate branch.
- [ ] Operator runbook, limitations, threat model, rollback and incident response documented.
- [ ] Release tagged as Devnet preview only after human signoff; otherwise NO-GO.

## Explicit non-goals
Mainnet, DEX pools, liquidity provisioning, token sale, automated custody transfers, Falcon on-chain verification claims, and production-ready security claims.

## First deliverable
A PR-by-PR dependency matrix and a reviewed, read-only Wallet/Dashboard candidate; keep experimental branches separate.
