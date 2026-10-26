# Falcon / PQC Compatibility Matrix

Updated: 2026-10-27 KST

Compared:
- PR #50 Four-Way Falcon compatibility gate
- branch research/pqc-falcon
- research/pqc/c1-sbf/src/lib.rs
- research/pqc/falcon-a1/Cargo.toml
- research/pqc/IMPLEMENTATION_PLAN_ABCD.md

## Verdict
**RESEARCH-ONLY IMPORT. Do not connect to Four-Way authorization yet.**

The current SBF research verifier has a clearly identified legacy verification path, but compatibility with FN-DSA is not established and runtime/custody gates are incomplete.

## Matrix
| Item | State | Verdict | Evidence |
|---|---|---|---|
| Upstream dependency pinned | tide-fn-dsa commit 30e5695f4c5718b1625d8f4227bed1ff0e872692 | PASS for provenance pin | Cargo.toml |
| Tidecoin legacy profile named explicitly | TidecoinLegacyFalcon512 | PASS | SBF verifier code |
| FN-DSA-512 implementation in inspected SBF path | not present | FAIL for compatibility claim | inspected code only verifies legacy profile |
| Legacy/FN-DSA wire compatibility | not demonstrated | UNKNOWN | docs warn they may differ |
| Default fail-closed build | rejects requests without experimental feature | PASS | SBF code |
| Experimental feature gate | present | PASS | falcon-experimental |
| Public key decoding | present | PARTIAL | trust-anchor governance incomplete |
| Program-owned key account path | prototype present | PARTIAL | no registration/update governance |
| Signature verification | research path present | PARTIAL | success explicitly non-authoritative |
| Cross-profile negative tests | not demonstrated | MISSING | required by implementation plan |
| Reproducible lock/build evidence | incomplete | UNKNOWN | Gate A not proven by inspected evidence |
| SBF compute units | not measured | MISSING | Gate C |
| Heap/stack/binary size | not measured | MISSING | Gate C |
| Serialized instruction size | not benchmarked | MISSING | Gate C |
| On-chain trust anchor governance | absent | MISSING | key provisioning not governed |
| On-chain nonce/expiry policy | absent from verifier | MISSING | future vault layer |
| Custody authorization | explicitly absent | PASS as safety property | verifier says no token authority |
| Quantum-resistant SHAH custody claim | unsupported | FAIL | no vault + no audited end-to-end path |

## Compatibility conclusions
### Tidecoin legacy Falcon-512
Status: **IMPLEMENTED as experimental verification research**

The inspected SBF code can attempt verification using the explicitly named Tidecoin legacy profile when the experimental feature is enabled. This is not yet an authorization mechanism.

### FN-DSA-512
Status: **UNKNOWN / NOT IMPLEMENTED in inspected verifier**

Do not relabel the legacy verifier as FN-DSA. Do not assume signatures or keys are interchangeable.

## Required evidence before interface integration
1. Profile test vectors: known-good legacy vectors, altered message/signature/key negatives, independently specified FN-DSA vectors, and cross-profile rejection tests.
2. Reproducible build: reviewed lockfile, exact Rust/Solana toolchain, upstream commit and successful CI logs.
3. SBF benchmark: compute units, heap, stack, binary size, instruction size and failure behavior near limits.
4. Trust anchor design: key registration, version, rotation, governance/authentication and emergency policy.
5. Four-Way binding: canonical bytes covering domain, network/genesis, program, vault, mint, recipient, amount, nonce, expiry, policy version and key version.

## Import recommendation
**RESEARCH-ONLY IMPORT**

Safe to reuse: profile descriptors, pinned provenance, fail-closed behavior and verification experiment code after review.

Do not import yet as production authorization, FN-DSA proof, custody authority, or a reason to weaken native Solana authorization.

## Result
Falcon/PQC interface status: **VALIDATING / BLOCKED for authorization integration**.
