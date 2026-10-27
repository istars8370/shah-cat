# PR #50 Integration Review

Updated: 2026-10-27 KST

## Verdict
**HOLD for merge to main.**

PR #50 is coherent as a research integration stack and its latest inspected head passes the relevant GitHub Actions checks. It is not yet ready to merge into main because architecture governance and release evidence remain incomplete.

## Verified state
- PR: #50
- Title: integration: Four-Way research stack #28-#49 (NO-GO production)
- Base: main
- Head: research/four-way-operations-checklist
- Head commit: f0897ee189354324030d67e9e684c1a06680271c
- State: open / draft / mergeable at inspection
- Size: 61 commits, 60 changed files, 1150 additions, 0 deletions
- Latest inspected workflow results:
  - Four-Way research unit tests: SUCCESS
  - SHAH CAT CI: SUCCESS

## What PR #50 contains
The stack adds:
- isolated Four-Way research modules and tests
- adversarial test coverage
- research-only CI
- canonical authorization envelope prototype
- integrity and recovery research
- Falcon compatibility inventory and fail-closed research gates
- Devnet read-only inspection and receipt verification
- Guardian on-chain implementation specification
- release/security runbooks
- external review scope

## Overlap with PR #27
PR #27 remains a separate draft containing:
- docs/research/four-way-architecture-v0.md
- docs/research/four-way-test-plan-v0.md

There is no direct filename collision with PR #50.

However there is **conceptual overlap**:
- common authorization envelope
- recovery requirements
- modular execution rules
- integrity evidence
- Falcon/FN-DSA gate
- acceptance/release gates
- test matrix

PR #27 should therefore be treated as the architecture baseline or explicitly superseded before PR #50 is merged.

## Unresolved blockers
1. Architecture source of truth is split between PR #27 and PR #50.
2. Guardian on-chain program is specified but not implemented and independently validated.
3. Falcon/PQC compatibility remains research-only.
4. Read-only Devnet checks and a basic SOL smoke test are not equivalent to Guardian or SHAH authorization validation.
5. Independent external review is absent.
6. Mainnet release remains NO-GO.

## Merge conditions for PR #50
Before changing HOLD to GO for research merge:
1. Decide whether PR #27 is:
   - merged first as the architecture baseline,
   - folded into PR #50,
   - or explicitly superseded with rationale.
2. Ensure PR #50 remains isolated from production authorization paths.
3. Re-run relevant CI on the final integration head.
4. Record remaining blockers in docs/ops/BLOCKERS.md.
5. Preserve NO-GO language for production and mainnet.

## Recommendation
Do **not** reject PR #50. It is valuable research work.

Recommended path:
- reconcile PR #27 and #50,
- merge only as a clearly labeled research stack,
- keep Guardian, Falcon/PQC and production authorization behind separate future gates.

Current recommendation: **HOLD**.
