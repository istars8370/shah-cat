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

## CTO checkpoint: refreshed 2026-10-27

### Exact pinned security heads and evidence
- #80: e77602463a19ef7f06acaf4528cf082679b41a91; SHAН CAT CI and SDK guard PASS; independent human reviews 0.
- #83: a3f68bb82a3d8bdeeb752ab08489166953e02896; SHAН CAT CI and offline security PASS; independent human reviews 0. New changes include dashboard/devnet-rpc.mjs, tests and dashboard/server.mjs compared with previous #83 head.
- [Joint exact-head CI 40454178171](https://github.com/istars8370/shah-cat/actions/runs/40454178171) PASS: #80 + updated #83 merged only in disposable CI checkout; no branch/main mutation. [Baseline CI 40454178137](https://github.com/istars8370/shah-cat/actions/runs/40454178137) PASS.
- The joint workflow verifies offline dashboard tests, modern SDK parity and dependency audit, plus offline RPC security tests; live wallet, Guardian/SBF and actual on-chain execution are not covered.

### PR #80 independent review gate (not approved)
- Verify modern package lock/provenance and licenses; fixture immutable, independent reference source retained.
- Inspect instruction account roles, unsigned wire parity, negative controls and absence of vulnerable legacy npm manifests.
- Check that Dashboard runtime was not changed, check source references of retired tools and ensure full audit on main after approval.
- Explicit human review is still missing. CI PASS must never be represented as security signoff.

### PR #83 independent review gate (not approved)
- Inspect RPC envelope and request-ID matching, mutation allow-list rejection, malformed ATA response, block height constraints and genesis check after simulation.
- Confirm HTTP and logging redaction across Dashboard routes, plus Treasury exemption boundaries and non-Treasury error response compatibility.
- Verify concurrency/out-of-order response tests, no signing/broadcast path, and no test suppression.
- External RPC honesty/slot consistency, real extension QA and live simulation remain unverified.

### Minimum-change Wallet integration plan — confirmed
1. Base current main plus separately reviewed security patches (#80/#83). Do not copy old dashboard files wholesale.
2. Port Wallet #20 foundation (public address/watch-only/history) to new isolated branch and retain main's Devnet/server security behaviors. Require baseline dashboard + offline security tests.
3. Port #22 multichain **read-only** registry/balances with network isolation. Preserve existing client request cancellation and tests.
4. Port #23's same-origin route/linking in small file units. Resolve dashboard/dashboard-ui.js, dashboard/index.html and dashboard/server.mjs against current main, especially new #83 RPC adapter and redacted errors; retain Dashboard Treasury/Genesis/ATA validation.
5. Port #67 EVM late-consent/stale-response guards unchanged in behavior. Run EVM reject/resolve-after-account-change/network-switch races.
6. Only afterward port #81 sample-only MONO RUN and UX changes; reconcile dashboard/dashboard.css and run 390px/1440px keyboard/browser QA.
7. Full regression on combined head: dashboard/*.test.mjs, modern SDK test, offline security suite, wallet-v1 tests, clean diff, no live mutation/signature; record actual extension QA separately.

### Ownership and authority
The CTO controls integration priority and PR review. Game/UX collaborator reviews PR #81 without touching Dashboard security and Wallet implementation. Gemini reviewer may review only when account access and handoff are confirmed; no AI review is a replacement for human external security approval. All edits must be isolated Draft PRs. No main merge, Treasury, wallet signature/transfer or Mainnet authorization is granted by this document.
