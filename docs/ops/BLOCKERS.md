# SHAH CAT Blockers

Updated: 2026-10-27 KST

| ID | Blocker | Status | Current evidence / closure path |
|---|---|---|---|
| B-001 | PR #27/#50 architecture source of truth | READY FOR INTEGRATION | PR #53 CI PASS |
| B-002 | Guardian stable PDA identity | CLOSED for research scope | PR #56 Guardian CI + SHAH CAT CI PASS |
| B-003 | Guardian authenticated recovery | VALIDATING | PR #57 implemented; CI pending |
| B-004 | Falcon/PQC compatibility evidence | EVIDENCE BLOCKED | legacy profile identified; FN-DSA vectors/runtime evidence missing |
| B-005 | Devnet Guardian execution evidence | BLOCKED BY G2 VALIDATION | no deployed authenticated recovery program |
| B-006 | Independent external review | OPEN | external report/remediation evidence absent |
| B-007 | Mainnet release gate | NO-GO | mandatory gates not satisfied |

## Guardian G2 evidence
PR #57 implements state-only authenticated recovery:
- signer quorum on direct Solana signer accounts
- durable nonce and guardian-set version checks
- trusted Clock-based delay/expiry
- owner-authenticated cancel and rotation
- permissionless finalize after state checks
- stable config_seed PDA validation
- no custody or token movement

G2 remains VALIDATING until CI passes.

## Evidence
- PR #53: architecture reconciliation
- PR #54: Guardian G1
- PR #55: Guardian G2 design
- PR #56: stable PDA fix
- PR #57: Guardian G2 implementation
- docs/ops/RELEASE_GATES.md
