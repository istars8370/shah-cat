# Codex Work Rules — SHAH CAT

Updated: 2026-10-27 KST

These rules are intended to reduce repeated prompting, context waste, and accidental scope expansion.

## 1. Read before changing
Before editing:
1. read docs/ops/PROJECT_STATE.md
2. read docs/ops/NOW.md
3. read docs/ops/BLOCKERS.md
4. inspect current branch and relevant PR/CI state
5. identify whether the task is P0, P1, or HOLD

If repository reality conflicts with an ops document, report the mismatch before claiming completion.

## 2. Work in packages
Every work package must state:

- Objective
- In scope
- Out of scope
- Files likely to change
- Validation commands or checks
- Completion criteria
- Remaining risks

Do not use open-ended instructions such as "improve everything" or "continue development".

## 3. WIP limit
Never advance more than 3 P0/P1 work packages at once.

If a fourth task appears:
- place it in P1 or HOLD
- do not start it unless one active item closes or is blocked

## 4. No unsupported completion claims
Use these labels exactly:
- DONE
- IMPLEMENTED
- VALIDATING
- BLOCKED
- PLANNED
- NO-GO

Do not upgrade a status without evidence.

## 5. Scope control
For current operations, default to:
- research review
- tests
- documentation
- reproducible Devnet validation

Do not broaden into new product surfaces unless the task explicitly requires it.

## 6. Change discipline
Prefer:
- small focused diffs
- one purpose per branch or PR
- tests alongside behavior changes
- documentation updates when project state changes

Avoid:
- unrelated refactors
- cosmetic changes during blocker work
- combining architecture changes with release claims
- silently changing assumptions

## 7. Output format after each package
Return:

### RESULT
DONE / IMPLEMENTED / VALIDATING / BLOCKED

### CHANGED
- files
- behavior or documentation changed

### VALIDATION
- checks run
- PASS / FAIL / NOT RUN

### EVIDENCE
- PR, commit, workflow, or file references

### RISKS
- unresolved issues

### NEXT
- no more than 3 recommended next actions

## 8. Stop conditions
Stop and report instead of guessing when:
- repository state contradicts the task assumptions
- required evidence is missing
- a change would unexpectedly broaden release scope
- the task depends on an unresolved blocker
- safe validation cannot be performed within the stated scope

## 9. Human decision points
Do not make the final decision to:
- merge a high-impact integration PR
- declare release readiness
- move from research scope to production scope

Prepare the evidence and recommendation for human approval.

## Session authorization
Explicit current-user authorization governs routine scoped merges and superseded-PR cleanup. The 2026-10-27 efficiency request authorized the reviewed #52/#53/#50/#62 integrations and historical PR cleanup; do not ask repeatedly for that same approval. Mainnet, funds, signing/authority changes and production release still need separately scoped authorization. Current lanes and queue are in AGENTS.md and NOW.md.
