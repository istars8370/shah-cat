# SHAH CAT Blockers

Updated: 2026-10-27 KST

| ID | Blocker | Status | Why it matters | Evidence needed to close |
|---|---|---|---|---|
| B-001 | PR #27/#50 architecture source of truth unresolved | OPEN | PR #50 review is complete, but merge remains HOLD until architecture governance is reconciled | explicit merge/fold/supersede decision plus reconciled docs |
| B-002 | Guardian integration boundary not validated | OPEN | release behavior must not rely on an unverified assumption | implementation gap map, tests, reproducible validation |
| B-003 | Falcon/PQC integration compatibility unresolved | OPEN | incompatible formats or interfaces can invalidate higher-level claims | compatibility matrix, test vectors/cross-check, runtime evidence, documented limitations |
| B-004 | Devnet end-to-end operational evidence incomplete | OPEN | read-only RPC inspection is not the same as proving the intended flow | reproducible Devnet evidence for the approved scope |
| B-005 | Independent external review absent | OPEN | internal tests cannot substitute for independent review | external review report or explicit decision to remain research-only |
| B-006 | Mainnet release gate unsatisfied | OPEN | mainnet should remain outside current operating scope | all mandatory release gates explicitly PASS |

## Progress evidence
- PR #50 integration review: docs/ops/PR50_INTEGRATION_REVIEW.md
- release gate definitions: docs/ops/RELEASE_GATES.md
- staged Devnet plan: docs/ops/DEVNET_VALIDATION_PLAN.md

## Blocker rules
Close only with inspectable evidence and documented limitations.

Do not close a blocker because:
- a prototype exists
- a unit test alone passes
- an AI says the design looks correct
- a read-only check succeeds
- a document merely states that work is complete

## Escalation
If a blocker cannot be closed without broadening scope, mark it DEFERRED or RESEARCH-ONLY with the reason.
