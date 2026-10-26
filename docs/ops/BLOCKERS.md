# SHAH CAT Blockers

Updated: 2026-10-27 KST

Use this file for blockers that prevent integration, release, or reliable validation.

| ID | Blocker | Status | Why it matters | Evidence needed to close |
|---|---|---|---|---|
| B-001 | PR #50 integration review incomplete | OPEN | Four-Way research stack is not yet accepted into main | reviewed diff, CI result, overlap check, written merge recommendation |
| B-002 | Guardian integration boundary not validated | OPEN | release behavior must not rely on an unverified assumption | documented boundary, tests, reproducible validation |
| B-003 | Falcon/PQC integration compatibility unresolved | OPEN | incompatible formats or interfaces can invalidate higher-level claims | agreed interface, cross-check vectors or equivalent validation, documented limitations |
| B-004 | Devnet end-to-end operational evidence incomplete | OPEN | read-only RPC inspection is not the same as proving the intended flow | reproducible Devnet evidence for the approved scope |
| B-005 | Independent external review absent | OPEN | internal tests cannot substitute for independent review | external review report or explicit decision to remain research-only |
| B-006 | Mainnet release gate unsatisfied | OPEN | mainnet should remain outside current operating scope | all mandatory release gates explicitly PASS |

## Blocker rules

A blocker can be closed only when:
- evidence exists in a PR, commit, workflow result, or document
- the result is reproducible or independently inspectable
- remaining limitations are written down

Do not close a blocker because:
- a prototype exists
- a unit test alone passes
- an AI says the design looks correct
- a read-only check succeeds
- a document merely states that work is complete

## Escalation
If a blocker cannot be closed without broadening scope, mark it as:
- DEFERRED, with reason and dependency
- or RESEARCH-ONLY, if production claims are intentionally excluded
