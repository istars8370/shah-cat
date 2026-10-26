# SHAH CAT Blockers

Updated: 2026-10-27 KST

| ID | Blocker | Status | Current evidence / closure path |
|---|---|---|---|
| B-001 | PR #27/#50 architecture source of truth | READY FOR INTEGRATION | PR #53 CI PASS |
| B-002 | Guardian stable PDA identity | CLOSED for research scope | PR #56 CI PASS |
| B-003 | Guardian authenticated recovery | CLOSED for research scope | PR #57 CI PASS |
| B-004 | Guardian replay/timing coverage | CLOSED for research scope | PR #58 CI PASS |
| B-005 | Devnet D0 read-only evidence | RUNNING | Actions run 40383873297 |
| B-006 | PR #59 Four-Way regression | RE-RUNNING | false-positive safety-test match fixed |
| B-007 | Falcon/PQC compatibility evidence | EVIDENCE BLOCKED | legacy profile identified; FN-DSA vectors/runtime evidence missing |
| B-008 | Devnet Guardian execution evidence | BLOCKED | D0 is read-only only |
| B-009 | Independent external review | OPEN | external review absent |
| B-010 | Mainnet release gate | NO-GO | mandatory gates not satisfied |

## D0 note
The D0 workflow was changed to run on PR changes because the available GitHub connector does not expose workflow_dispatch. This trigger remains read-only and contains no signing or transaction step.

## Evidence
- PR #58: Guardian G3
- PR #59: Devnet D0 read-only evidence gate
- Actions run 40383873297: live D0 execution
