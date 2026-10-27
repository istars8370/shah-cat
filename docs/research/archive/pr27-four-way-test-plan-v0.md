<!-- Historical PR #27 baseline; superseded by ../four-way-source-of-truth.md. Retained to avoid losing threat-model and acceptance criteria. -->
# Four-Way Verification Matrix v0.1

Status: PLANNED TESTS, NOT PASSED. No funds, mainnet deployments or authority changes are authorized by this document.

| ID | Track | Positive test | Negative / attack test | Pass evidence |
|---|---|---|---|---|
| A01 | Adaptive | low-risk authorized transfer | changed recipient after signing | deterministic unit test |
| A02 | Adaptive | elevated action with second factor | bypass via fabricated AI risk score | on-chain rejection |
| A03 | Adaptive | valid auxiliary signature | wrong domain/network, expired nonce | verifier transcript |
| B01 | Recovery | guardian quorum and timelock | one compromised guardian | state transition log |
| B02 | Recovery | rotate owner key | old owner spends after recovery | rejected transaction |
| B03 | Recovery | cancel within delay | race between cancel and finalize | adversarial test |
| C01 | Modular | allowlisted module upgrade | unapproved program ID | policy hash proof |
| C02 | Modular | mandatory module unavailable | silent allow on module error | fail-closed test |
| C03 | Modular | versioned serialization | malformed/unknown version | property-based test |
| D01 | Integrity | verify approval chain | forged approval event | external verifier |
| D02 | Integrity | bind execution to approval | altered amount or destination | mismatch rejection |
| D03 | Integrity | verify public log | missing/reordered records | audit gap detection |
| X01 | Cross-track | normal A+B+C+D transfer | key rotation during pending transfer | integration test |
| X02 | Cross-track | emergency recovery | simultaneous transfer and lock | concurrency test |
| X03 | Cross-track | reproducible build | binary differs from source | build provenance |

## Metrics to collect
- Verification compute units and fees per tier.
- Serialized transaction size and signature evidence size.
- Success/rejection latency at p50/p95 under test conditions.
- False-positive rate of any advisory AI detector (never use as sole authority).
- Recovery time, guardian quorum and cancellation behavior.
- Percentage of security invariants covered by automated tests.

## Exit criteria
G1: every track has executable local tests and at least one adversarial rejection.
G2: cross-track invariants tested on Devnet.
G3: external reviewer signs off, security findings triaged, reproducible builds verified.
G4: owners explicitly approve any migration or real-fund deployment.

## Current repository observations (2026-10-26)
README describes Devnet SPL mint and Dashboard 2.0. Treasury UI explicitly states policy approval is not an on-chain multisig payment. GitHub code search did not surface Falcon files on default branch; investigate local and other branches before claiming implementation.
