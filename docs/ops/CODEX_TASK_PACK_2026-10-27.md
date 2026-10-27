# Codex Task Pack — 2026-10-27

Read first:
- docs/ops/PROJECT_STATE.md
- docs/ops/NOW.md
- docs/ops/BLOCKERS.md
- docs/ops/CODEX_RULES.md
- docs/ops/PR50_INTEGRATION_REVIEW.md
- docs/ops/RELEASE_GATES.md

Work on **only these 3 packages**. Do not start a fourth.

## PACK A — PR #27 / #50 architecture reconciliation

Objective:
Produce the smallest safe reconciliation plan between PR #27 architecture/test docs and PR #50 research stack.

In scope:
- compare terminology, invariants, envelope fields, acceptance gates and test expectations
- identify contradiction vs duplication
- recommend one of: merge #27 first / fold into #50 / supersede #27

Out of scope:
- runtime implementation changes
- mainnet work
- release declaration

Completion:
- comparison table
- exact files to keep/change
- written recommendation
- no unresolved contradiction left unnamed

## PACK B — Guardian implementation gap map

Objective:
Map the existing Four-Way recovery prototype against docs/research/four-way-onchain-guardian-spec-v0.md.

In scope:
- program state requirements
- signer/authentication model
- nonce/replay behavior
- trusted timing
- cancellation/finalization/rotation
- test requirements

Out of scope:
- production custody
- mainnet deployment
- Treasury integration

Completion:
- IMPLEMENTED / MISSING / UNKNOWN matrix
- minimal Devnet implementation sequence
- exact tests required before any success claim

## PACK C — Falcon/PQC compatibility matrix

Objective:
Determine whether current Falcon research artifacts can safely interface with Four-Way authorization.

In scope:
- profile names and signature formats
- upstream source/provenance
- available test vectors
- compatibility assumptions
- runtime/resource benchmark requirements
- fail-closed behavior

Out of scope:
- claiming quantum resistance
- connecting experimental verification to production authorization
- merging the whole divergent Falcon branch

Completion:
- PASS / FAIL / UNKNOWN matrix
- required vectors/benchmarks
- import recommendation: DO NOT IMPORT / RESEARCH-ONLY IMPORT / READY FOR SEPARATE IMPLEMENTATION REVIEW

## Required report format
### RESULT
DONE / IMPLEMENTED / VALIDATING / BLOCKED

### CHANGED
- files

### VALIDATION
- checks run
- PASS / FAIL / NOT RUN

### EVIDENCE
- PR / commit / workflow / file

### RISKS
- unresolved issues

### NEXT
- maximum 3 next actions
