# SHAH CAT Command Center 2.0 — Collaboration Protocol

Status: DRAFT / research and operations only. Human approval required for merge.
Date: 2026-10-27 KST

## Purpose
Reduce duplicated AI work and convert existing draft PRs into verifiable, reviewable changes. Do not equate PR count with delivered functionality.

## Owners and scopes
- Lead ChatGPT / CTO: architecture, Guardian and Devnet research, security gates, final integration recommendation.
- Product ChatGPT: Wallet, Dashboard, UI/UX and independent functional QA.
- Gemini collaborator: CI/CD, dependency checks, developer environment and automation.
- Human maintainer: all merges, releases, credentials, money movement and security-critical approvals.

AI account conversations are not shared state. Attribution must be backed by a PR, branch, issue, or explicit owner record. Do not infer ownership from the AI used.

## Single source of truth
- docs/ops/NOW.md: active priorities (maximum three P0 across the team).
- docs/ops/BLOCKERS.md: evidence gaps and safety holds.
- GitHub Issues: one task, one owner, acceptance criteria and related PR.
- Draft PR: implementation, tests, evidence, risks and reviewer.

## Work intake and WIP limits
1. Read only relevant changed PRs, CI and ops docs since last run.
2. Check for overlapping files and existing work before selecting an issue.
3. Maximum three team-wide P0 issues; one implementation task per AI execution.
4. Maximum two unmerged draft PRs per collaborator; avoid creating new PRs while old work is blocked.
5. Classify open PRs as READY_FOR_REVIEW, NEEDS_FIX, DUPLICATE, BLOCKED or ARCHIVE_CANDIDATE. Classification is advisory, not an authorization to close or merge.
6. Prefer closing CI/test gaps and PR review over feature expansion.
7. Record exact commit SHA and check result; distinguish PASS, FAIL, PENDING and NOT_RUN.
8. Human approval required for merge, even if CI is green.

## Required PR evidence
- Scope and linked issue
- Files changed and reason
- Test commands and observed results, with workflow links when available
- Dependency or security impact
- Overlapping PRs and merge/conflict risk
- Rollback plan and human approval needed

## Security and release holds
No mainnet release, production custody, Treasury movement, real-fund operations, Falcon/PQC authorization integration, secret handling or unapproved Devnet transfers. Guardian and Falcon work remains research-only until explicit gates and independent review are satisfied.

## Initial queue (verify latest GitHub state each run)
P0-1: Review PR #60 Devnet D1 design; design only, no transfer.
P0-2: Falcon evidence package: vectors, reproducible build and SBF benchmark; no auth integration.
P0-3: Human integration decision for PR #53, with CI and architecture evidence.
Backlog: classify existing draft PRs, then implement low-risk CI quality improvements in independent drafts.

## Reporting and capacity
Daily integration report: changed PRs, CI status, blockers, owner next actions (max three). Weekly metrics: review-ready PRs, merged PRs, CI failure rate, rework, human review hours and duplicate work. Skip redundant analysis when no evidence changed. Automation frequency does not guarantee credit usage or throughput.
