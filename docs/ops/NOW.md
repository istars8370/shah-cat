# SHAH CAT NOW

## Current approved stabilization checkpoint (2026-10-27 KST)

This section supersedes the historical queue below. User explicitly authorized the audit's three stabilization packages and merging validated PRs. Maximum three active packages; preserve source branches. No transactions, custody, Mainnet deployment or production release are authorized.

- DONE security integration: #86 merged into #80 at `bc12f71a2684271a73bb37abb5aeb4cfba9e8077`; #80 squashed into main at `87e5179a8b0568e0f1859e772bb6d7d2c2a8e885`; #83 refreshed against that main and squashed at `5ce739b7bc3d8444787b0ce408c08a9a44469752`.
- Local combined security: Dashboard/Four-Way 428/428, guarded offline 249/249, modern SDK 13/13; zero failures/skips. Full modern lock audit zero vulnerabilities. Suites overlap and are not summed. #80 main CI/audit passed; check final main SHA after each subsequent merge.
- Package 1 / current executor: unconditional security CI and stronger main verification/review requirements. Target required contexts: Dashboard automated tests, Solana SDK byte equivalence and Stabilization security gate. Preserve strict up-to-date enforcement and existing deletion/force-push protection. Require one approving reviewer for future PRs. A document is not proof of actual GitHub settings; verify the API after applying.
- Package 2 / current executor: reconcile operations and exact SHA/check evidence. At approved execution start there were 35 Open PRs; #86/#80/#83 merged, other source PRs retained. Read GitHub for current inventory.
- Package 3 / current executor: Wallet #89 retargeted to main, preserving source #20/#22/#23/#67/#87. Includes current security baseline and selected #67 fix; implementation checkpoint `ff03e2cf3f417fbf4ad841a58d8b16da6e223294`. Shared hardened history transport and fixed errors, concurrent/round-trip/page-exit consent regression. Local combined 475/475; four-chain actual read-only RPC success; IAB Ethereum rendering, invalid address/no-provider behavior and disabled send verified. HOLD: installed Phantom/EVM extension approval/rejection/account switching and independent explorer comparison. Native Whale binding failed; IAB has no compatible extension. Do not replace these missing checks with mock results.
- Deferred research: #54–#60 still unmerged. Host cargo tests do not establish SBF/runtime authorization, deployment or custody. D0 read-only evidence is separate from D1 design; no D1 execution.
- HOLD: Falcon authorization, Guardian custody, Treasury movement, DEX/LP operations, Mainnet and production release. Gemini remains PAUSED until availability and explicit handoff are re-established.

## Historical checkpoint — superseded by current section above

Updated: 2026-10-27 KST. Maximum three active packages. Current GitHub evidence overrides this checkpoint.

## Completed integration
- #52 merged into main: operations documents.
- #53 merged into #50; #50 merged into main at `f163bad7c20fc8244407b1bec1875518b25f0c41`.
- #27 superseded, original baseline retained verbatim in `docs/research/archive/pr27-*`.
- #28–#49 integrated; historical PRs closed/merged after exact ancestor verification. Source branches retained.
- #62 merged into #23's integration branch only; Wallet chain #20 -> #22 -> #23 remains open.
- Open PR count reduced from 42 to 15 before the follow-up efficiency PR.

## P0-1 — Dependency findings and reproducible CI
Owner: Seongjae's ChatGPT acting for paused Gemini.
Acceptance: committed SDK lockfile, deterministic install, automatic audit, explicit finding status. No forced upgrades.
Security follow-up: resolve/review `bigint-buffer` advisory GHSA-3gc7-fjrx-p6mg and transitive findings before declaring dependency health clean.

## P0-2 — Guardian/Devnet integration evidence
Owner: technical coordinator on next scoped task.
Next: inspect #54 -> #55 -> #56 -> #57 -> #58 -> #59 -> #60 against newly merged research main; review exact heads/CI before any integration.
Acceptance: actual program build/test evidence separated from JS mocks; D0 read-only evidence separated from D1 design and actual execution.
No Guardian deployment, D1 transfer, custody or signing is authorized by this queue.

## P0-3 — Wallet chain integration QA
Owner: task claimant; no parallel overlapping edits without a recorded handoff.
Next: review #20 -> #22 -> #23, now including #62; account for #67 consent race patch and latest main tokenomics.
Acceptance: final integration tests plus actual browser/extension QA recorded before runtime integration.

## HOLD
Falcon authorization, Guardian token custody, Treasury movement, DEX expansion, Mainnet and production release. Falcon vectors/build/SBF benchmarks and external review remain missing.

Gemini is PAUSED due to account limit. Do not assign work to that account until availability and handoff are explicitly re-established.
