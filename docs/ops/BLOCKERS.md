# SHAH CAT Blockers

Updated: 2026-10-27 KST

| ID | Blocker | Status | Current evidence / closure path |
|---|---|---|---|
| B-001 | PR #27/#50 architecture source of truth | IN PROGRESS | PR #53 implements reconciliation |
| B-002 | Guardian stable PDA identity | VALIDATING | PR #56 adds immutable config_seed before G2 |
| B-003 | Guardian authenticated recovery | BLOCKED BY B-002 | G2 design exists in PR #55; implementation paused |
| B-004 | Falcon/PQC compatibility evidence | EVIDENCE BLOCKED | legacy profile identified; FN-DSA vectors/runtime evidence missing |
| B-005 | Devnet Guardian execution evidence | BLOCKED BY G2+ | no authenticated recovery program deployed |
| B-006 | Independent external review | OPEN | external report/remediation evidence absent |
| B-007 | Mainnet release gate | NO-GO | mandatory gates not satisfied |

## Important Guardian design correction
The initial G1 PDA derivation used owner + mint. Because recovery changes owner, G2 requires a stable immutable derivation identity.

PR #56 introduces:
- config_seed: immutable initialization identity
- owner: mutable current authority
- state version 2
- updated fixed state layout

G2 must validate the config PDA using config_seed + mint, never the mutable current owner.

## Evidence
- PR #53: architecture reconciliation
- PR #54: Guardian G1
- PR #55: Guardian G2 design
- PR #56: stable PDA prerequisite fix
- docs/ops/GUARDIAN_GAP_MAP.md
- docs/ops/RELEASE_GATES.md
