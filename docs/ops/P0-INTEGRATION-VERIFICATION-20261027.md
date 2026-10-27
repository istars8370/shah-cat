# SHAH CAT P0 integration verification (2026-10-27)

Status: planning and evidence only. No combined integration, main merge, wallet signing or transfers.

## Current PR status
- #80 modern SDK: open, ready for review. CI and SDK dependency guard passed.
- #83 Devnet security: draft. Offline security CI and core CI passed.
- #82 integration inventory: draft, core CI passed.
- #81 MVP and MONO RUN preview: draft, core CI passed.
- #23 Wallet Dashboard: draft, stacked, 111 commits behind main.
- #67 EVM consent race: draft stacked on #23, 111 commits behind main.

## #80 versus #83
Compared each head with current main: modified path sets do not intersect. #80 modifies CI, SDK manifests, modern verifier and reference docs. #83 modifies transfer-quote, security tests and offline security workflow/scripts. Therefore direct file conflict looks low. Combined-tree build and CI NOT EXECUTED: operational compatibility remains unverified. After human review run dashboard suite, modern SDK byte vectors, offline security tests, full dependency audit on one combined commit.

## Wallet #23/#67 versus MVP #81
Main-relative changes overlap on dashboard/index.html, dashboard/server.mjs and dashboard/dashboard.css. #23/#67 are diverged and 111 commits behind main. A pull request being mergeable against its stacked parent does not prove it is clean against main. Follow original stack #20 -> #22 -> #23 -> #67; create a disposable current-main integration branch, resolve HTML/CSS/server conflicts while preserving Devnet quote and Treasury behavior, retest EVM stale-consent protection. Only then introduce #81 sample-only MONO RUN/UX changes and test browser 390px / 1440px, accessibility and read-only wallet workflows.

## Security/regression gaps
- #83 still calls out unverified generic RPC envelope/id checks and complete error redaction.
- No combined #80+#83 test run; independent human security approval missing.
- No real Phantom/Solflare browser QA or live simulation in this assessment.
- Keep original frozen reference fixture unchanged. Do not run legacy dependency manifests.
- Preserve all current dashboard tests and Devnet negative scenarios; do not weaken security CI.

## Ordered next steps
1. P0 independent code review #80 and #83; create isolated combined-test branch and run its CI before any merge.
2. P0 synchronize #82 documentation and check changed PR heads before integration.
3. P1 reconcile Wallet stack on latest main, preserving #67 EVM race tests.
4. P2 reconcile #81 MVP UI and only then test mobile/desktop and wallet extensions.
5. Keep all PRs unmerged pending human review. Never sign/send, move assets, change Treasury, auto-merge or deploy Mainnet.

Completion: evidence inspection and coordination documented. Pending: merge-tree, combined CI, human approval, Wallet resolution, browser QA.
