# External independent security audit request — DRAFT, NOT AN AUDIT

## Proposed scope
- Solana on-chain vault and recovery program (once implemented): PDA derivation, signer checks, guardian uniqueness/threshold, nonce/epoch, Clock sysvar, timelock, SPL token authority, reentrancy/CPIs, account substitution, upgrade authority.
- Falcon/Tidecoin legacy vs FN-DSA: pinned dependencies, deterministic cross-language vectors, signature format separation, on-chain compute and heap limits, false acceptance/rejection.
- Off-chain modules: canonical request encoding, Ed25519 verification, policy tiers, audit record integrity, module governance, replay and crash recovery.
- Deployment/operations: key custody, role separation, source reproducibility, CI provenance, rollback and monitoring.

## Deliverables required from independent auditor
- Named auditor and independence/conflict declaration
- Fixed commit SHA, deployed program ID and build provenance
- Reproducible test steps and transaction evidence
- Severity-ranked findings with exploitability and affected files
- Remediation PRs and auditor retest results
- Signed/published final report with explicit residual risks

## Status
No external auditor engaged, no contract or payment, no external findings, no independent certification. Do not label internal CI or this document as an independent audit. Audit should be commissioned only after a testable on-chain program and stable code freeze.
