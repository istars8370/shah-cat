# SHAH CAT Shared Work Queue

Updated: 2026-10-27 KST
Queue source: GitHub + command-center PR #52 (not main yet)
WIP cap: **3 active P0 total, not 3 per contributor.**

| ID | Priority | State | Proposed owner | Dependency | Acceptance / evidence |
|---|---|---|---|---|---|
| P0-01 | P0 | REVIEW REQUIRED | Joint reviewer, not yet assigned | PR #60, D0 evidence PR #59 | Verify D1 design's ephemeral wallet, faucet-only, no-signing automation, receipt plan; publish reviewer decision; no actual transfer |
| P0-02 | P0 | HUMAN DECISION | Joint reviewer, not yet assigned | PR #53 -> #50; architecture docs, CI | Decide integration with explicit dependency plan; no AI merge; PR #27 supersession only after approval |
| P0-03 | P0 | BLOCKED ON EVIDENCE | Technical research contributor, not yet assigned | PR #30 Falcon compatibility, research baseline | Independent vector source, exact algorithm/version, reproducible build and SBF feasibility evidence; no authorization wiring |
| P1-01 | P1 | PROPOSED | Either collaborator | Issue #61; scope confirmation | Agree on creative/game/QA scope and evidence; no assumed role assignment |
| P1-02 | P1 | PLANNED | AI PM | PR #50 stacked chain | Produce reviewable dependency map and closure order, do not close/merge without approval |

## Work-package lifecycle
`PLANNED -> ACCEPTED -> IN_PROGRESS -> VALIDATING -> REVIEW_REQUIRED -> DONE`
or `BLOCKED` / `HOLD`.

`DONE` must explicitly state whether it means a **research task validated**, **PR merged**, or **production deployed**. These are not interchangeable.

## Two-person handoff
- Claim a package in the GitHub issue/PR thread with the contributor's verified GitHub handle.
- Before working, confirm another participant/AI is not already editing the same files.
- Commit on a small branch targeting the correct integration branch.
- Attach link, exact test command/outcome, and remaining risk.
- Request human decision only when there is a concrete GO/HOLD packet.

## Safety
No mainnet, Treasury asset movement, production custody, Falcon/PQC authorization integration, actual token transfer, or Devnet signing/transfer without a separately authorized work package.
