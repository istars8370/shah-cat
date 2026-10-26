# SHAH CAT Blockers

Updated: 2026-10-27 KST

| ID | Blocker | Status | Current evidence / closure path |
|---|---|---|---|
| B-001 | PR #27/#50 architecture source of truth | IN PROGRESS | PR #53 implements reconciliation |
| B-002 | Guardian G1 state foundation | CLOSED for research scope | PR #54 CI PASS; 6/6 unit tests PASS |
| B-003 | Guardian authenticated recovery | DESIGN COMPLETE / IMPLEMENTATION OPEN | PR #55 defines G2 behavior and tests |
| B-004 | Falcon/PQC compatibility evidence | EVIDENCE BLOCKED | legacy profile identified; FN-DSA vectors/runtime evidence missing |
| B-005 | Devnet Guardian execution evidence | BLOCKED BY G2+ | no authenticated recovery program deployed |
| B-006 | Independent external review | OPEN | external report/remediation evidence absent |
| B-007 | Mainnet release gate | NO-GO | mandatory gates not satisfied |

## Guardian notes
G1 closure applies only to the state-only research scope.

Observed non-blocking warnings:
- Solana macro cfg warnings under current toolchain
- deprecated Solana system imports

These should be cleaned before later deployment-oriented gates.

## Evidence
- PR #53: architecture reconciliation
- PR #54: Guardian G1 implementation
- PR #55: Guardian G2 design
- docs/ops/GUARDIAN_GAP_MAP.md
- docs/ops/FALCON_COMPATIBILITY_MATRIX.md
- docs/ops/RELEASE_GATES.md
- docs/ops/DEVNET_VALIDATION_PLAN.md
