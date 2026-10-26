# SHAH CAT Blockers

Updated: 2026-10-27 KST

| ID | Blocker | Status | Current evidence / closure path |
|---|---|---|---|
| B-001 | PR #27/#50 architecture source of truth | IN PROGRESS | draft PR #53 implements fold/supersede path |
| B-002 | Guardian G1 state foundation | VALIDATING | draft PR #54 implemented; CI evidence pending |
| B-003 | Guardian authenticated recovery | BLOCKED BY G1 | do not start G2 until G1 review/CI passes |
| B-004 | Falcon/PQC compatibility evidence | EVIDENCE BLOCKED | legacy profile identified; FN-DSA vectors/runtime evidence missing |
| B-005 | Devnet end-to-end operational evidence | OPEN | D2/D3 blocked by actual Guardian implementation |
| B-006 | Independent external review | OPEN | external report/remediation evidence absent |
| B-007 | Mainnet release gate | NO-GO | mandatory gates not satisfied |

## Guardian G1 evidence
PR #54 currently adds:
- deterministic config PDA creation
- persisted state fields only
- no recovery execution
- no custody
- dedicated unit-test workflow

G1 cannot be marked DONE until automated validation succeeds and review confirms the state layout/initialization path.

## Other evidence
- PR #50 review: docs/ops/PR50_INTEGRATION_REVIEW.md
- architecture decision: docs/ops/ARCH_RECONCILIATION_27_50.md
- architecture reconciliation: PR #53
- Guardian gap map: docs/ops/GUARDIAN_GAP_MAP.md
- Falcon matrix: docs/ops/FALCON_COMPATIBILITY_MATRIX.md
- release gates: docs/ops/RELEASE_GATES.md
- Devnet plan: docs/ops/DEVNET_VALIDATION_PLAN.md
