# Four-Way Architecture Reconciliation Decision

Updated: 2026-10-27 KST

## Decision
**Fold PR #27 architecture/test documents into the PR #50 research integration line before any merge to main.**

Do not merge #27 and #50 independently as two competing sources of truth.

## Why this path
PR #27 contains the clearest top-level architecture baseline:
- threat model
- common authorization envelope requirements
- four-track responsibilities
- cross-track invariants
- Falcon/FN-DSA research gate
- staged acceptance gates
- initial verification matrix

PR #50 contains the larger implementation/research evidence set:
- executable research modules
- adversarial tests
- CI workflow
- operations/security runbooks
- Devnet read-only and receipt tooling
- Guardian implementation specification
- Falcon compatibility inventory
- release/security gates

The two are complementary, not competing. Keeping them as separate long-lived PRs creates governance ambiguity.

## Reconciliation rule
Treat the PR #27 documents as the architecture baseline, and PR #50 as the research implementation/evidence stack.

Before PR #50 may become GO for a research-only merge:
1. bring four-way-architecture-v0.md and four-way-test-plan-v0.md into the PR #50 integration branch, or create successor documents there that explicitly supersede them;
2. update stale statements in #27 so they reflect evidence already present in #50;
3. preserve stronger safety language from #50 where #27 is only aspirational;
4. add a short source-of-truth note naming the canonical architecture and test matrix;
5. close or supersede PR #27 after the content is incorporated.

## Comparison
| Topic | PR #27 | PR #50 | Decision |
|---|---|---|---|
| Threat model | baseline | expanded per-module docs | keep baseline + link expansions |
| Common envelope | explicit required fields | canonical-envelope prototype | baseline governs; prototype is evidence |
| Adaptive authorization | conceptual | research module/tests | keep both roles separated |
| Recovery | conceptual requirements | JS prototype + on-chain spec | on-chain spec supersedes prototype claims |
| Modular execution | conceptual | registry/governance tests | baseline governs |
| Integrity | conceptual | ledger/verifier/adversarial tests | evidence under baseline |
| Falcon/FN-DSA | compatibility warning | profile gate + legacy inventory | #50 evidence governs current state |
| Acceptance gates | G0-G4 | security/release gates | map G0-G4 to current evidence |
| Test matrix | planned | many executable tests | update matrix with PASS/NOT RUN/BLOCKED |

## Recommendation for PR #27
**SUPERSEDE AFTER FOLDING CONTENT.**

Do not merge #27 separately into main after #50 contains the reconciled baseline.

## Result
Architecture governance status: **DECIDED**

Implementation action still required on the #50 branch before its merge status can move from HOLD to GO.
