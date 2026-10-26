# SHAH CAT NOW

Updated: 2026-10-27 KST

Maximum 3 active high-priority work packages.

## Completed this cycle

### 1. Guardian G2 authenticated recovery — DONE for research scope
Evidence:
- PR #57
- Guardian research CI: PASS
- SHAH CAT CI: PASS
- 9/9 Guardian unit tests PASS

Implemented:
- initiate_recovery
- cancel_recovery
- finalize_recovery
- rotate_guardians
- direct Solana signer-account Guardian quorum
- trusted Clock sysvar
- durable recovery nonce
- Guardian-set version checks
- bounded expiry window
- stable config_seed PDA validation

Still excluded:
- token custody
- token movement
- Treasury
- Falcon/PQC authorization
- Devnet deployment
- mainnet

### 2. Guardian G3 replay/timing hardening — IMPLEMENTED / CI PENDING
Evidence:
- PR #58

Added adversarial tests:
- canceled recovery nonce cannot be reused
- finalized recovery nonce cannot be reused
- exact executable-after boundary succeeds
- pre-delay boundary fails
- exact expiry boundary fails closed
- stale Guardian-set version fails after rotation
- maximum expiry window enforced

### 3. PR #53 architecture reconciliation — CI PASS
Evidence:
- PR #53

## P0 — active next

### 1. Validate PR #58 CI
Done when:
- Guardian tests PASS
- SHAH CAT CI PASS
- no replay/timing blocker remains in local research scope

### 2. Integrate PR #53 architecture source of truth
Goal:
- accept reconciled Four-Way architecture/test governance
- supersede PR #27 after review

### 3. Falcon evidence package
Goal:
- reproducible vectors
- reproducible build evidence
- SBF runtime benchmark
- no authorization integration

## P1
- Devnet D0 read-only validation
- Devnet D1 disposable SOL smoke test
- Guardian deprecation/cfg cleanup
- Treasury workflow consistency review

## HOLD
- Guardian token custody
- Treasury integration
- Falcon authorization integration
- DEX expansion
- mainnet
