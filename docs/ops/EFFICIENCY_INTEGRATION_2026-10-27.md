# Efficiency integration evidence — 2026-10-27 KST

## Scope completed before this follow-up
- #52 -> main: merge 1ff9b9dca28a5693e93836ae53e8734be18b5818. Stale required-check expectation resolved by incorporating current main and rerunning CI; no rule bypass.
- #53 -> #50 branch: merge eafca9b2f7cf7c7693e5205c0f15cc0e5cb1d97f.
- #62 -> #23 branch: merge ee5f9c1b431788bb0fdc21426193ca73f98da437, not main. 221 Dashboard + Wallet offline tests passed at #62 head.
- #50 -> main: merge f163bad7c20fc8244407b1bec1875518b25f0c41, final head d6f62a46292653579b63b0bf4621c42877e12228. 379 research + Dashboard local tests passed. SHAH CAT CI 40429598114 and Four-Way tests 40429598172 succeeded.
- #28 was automatically marked merged. #29–#49 were closed after all exact branch heads were verified ancestors of main. #27 was explicitly superseded with both original files retained verbatim in archive. Source branches retained.
- Open PRs: 42 at first inventory -> 15 after cleanup, before this follow-up PR. Remaining: #20, #22, #23, #26, #54–#60, #63, #65–#67. No claim of fewer than 10.

## Missing external patch
`collab-gemini-ci-suite-all.patch` was not present in the accessible files searched. Its claimed 24 tests cannot be verified or imported. This follow-up independently implements the requested CI purpose and is not a byte-for-byte reconstruction or attribution of that patch.

## CI improvements
- Pin SDK transitive dependencies with a committed lockfile and npm ci --ignore-scripts.
- Research workflow runs after changes to research on main as well as relevant pull requests.
- Dedicated dependency audit checks both SDK tool lockfiles on relevant PRs, main pushes, weekly schedule and manual dispatch. Read-only permissions, no secrets or automated upgrades. Weekly Monday 00:00 UTC = 09:00 KST.
- Audit failure remains visible and is not converted to success. Existing high findings are tracked as B-011; adding detection does not remediate them.

## Dependency audit observation
Both tool audits returned 3 high and 6 moderate affected-package entries; these overlap between tools and through dependency propagation, not 18 unique vulnerabilities. High root advisory: https://github.com/advisories/GHSA-3gc7-fjrx-p6mg (`bigint-buffer`). npm proposes incompatible major/downgrade changes; no force-fix performed. Runtime exploitability was not established by a package audit.

## Throughput claims
3–5x improvement is a hypothesis. Measure review time, throughput of accepted packages, CI failures and rework over the next week before assigning a multiplier. Retiring historical PRs reduces scan volume but does not prove a proportional speed gain.

## Remaining limits
Guardian real-runtime validation, Falcon vectors/build/SBF evidence, Wallet extension/browser QA, dependency remediation and independent external audit remain unresolved. No network transaction, authority change or production release was performed.
