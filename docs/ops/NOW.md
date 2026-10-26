# SHAH CAT NOW

Updated: 2026-10-27 KST

Maximum 3 active high-priority work packages.

## Completed this cycle

### 1. Guardian G3 replay/timing hardening — DONE for research scope
Evidence:
- PR #58
- Guardian research CI: PASS
- SHAH CAT CI: PASS

Covered:
- canceled recovery nonce reuse rejection
- finalized recovery nonce reuse rejection
- exact executable-after boundary
- pre-delay rejection
- exact expiry rejection
- stale Guardian-set version rejection after rotation
- maximum expiry-window enforcement

### 2. Devnet D0 read-only evidence gate — READY / NOT EXECUTED
Evidence:
- PR #59
- research/four-way/devnet-d0-evidence.mjs
- research/four-way/devnet-d0-evidence.test.mjs
- .github/workflows/devnet-d0-readonly.yml
- docs/research/devnet-d0-readonly-evidence.md

D0 scope:
- expected Devnet genesis hash
- finalized slot
- Solana node version
- structured evidence with commit SHA

D0 explicitly contains:
- no keys
- no signing
- no transaction submission
- no deployment
- no account mutation

Live D0 workflow has not yet been manually executed.

### 3. Guardian G2 authenticated recovery — DONE for research scope
Evidence:
- PR #57
- Guardian CI PASS
- SHAH CAT CI PASS
- 9/9 tests PASS

## P0 — active next

### 1. Validate PR #59 normal CI
Done when:
- Four-Way research tests PASS
- SHAH CAT CI PASS
- D0 safety test PASS

### 2. Execute Devnet D0 manually
Only after PR #59 validation.
Done when:
- manual D0 workflow completes
- expected Devnet genesis matches
- finalized slot/version evidence captured
- readOnly=true and transfersEnabled=false

### 3. Integrate PR #53 architecture source of truth
Goal:
- accept reconciled Four-Way architecture/test governance
- supersede PR #27 after review

## P1
- Falcon evidence package
- Devnet D1 disposable SOL smoke test
- Guardian deprecation/cfg cleanup
- Treasury workflow consistency review

## HOLD
- Guardian token custody
- Treasury integration
- Falcon authorization integration
- DEX expansion
- mainnet
