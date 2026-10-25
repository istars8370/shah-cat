# Four-Way Falcon compatibility inventory (research only)

Source: branch `research/pqc-falcon`, compared against main on 2026-10-26.

## Verified repository observations
- Branch diverged: 40 commits ahead and 53 behind main at inspection time. Do not merge the whole branch.
- `research/pqc/falcon-a1/Cargo.toml` pins `tide-fn-dsa` to upstream commit `30e5695f4c5718b1625d8f4227bed1ff0e872692`.
- `research/pqc/c1-sbf/src/lib.rs` has a feature-gated `FalconProfile::TidecoinLegacyFalcon512` verification path, plus a default fail-closed path.
- The SBF research verifier expressly does not control token custody, approve transactions, or confer quantum resistance on SHAH.
- `research/pqc/IMPLEMENTATION_PLAN_ABCD.md` identifies unpassed A/B/C/D gates, requires source provenance and negative tests, and warns that legacy and FN-DSA formats may differ.

## Decision
Do not import experimental Falcon verification into Four-Way transfer authorization yet. This PR adds an explicit profile compatibility descriptor and a fail-closed authorization gate, not cryptography.

## Required next experiments
1. Obtain upstream licensing, pinned lockfile and reproducible Rust build.
2. Record actual test vectors for Tidecoin legacy and independently specified FN-DSA profile.
3. Benchmark SBF compute, heap, binary and serialized instruction sizes.
4. Establish a governed trust anchor for the authorized Falcon public key.
5. Implement a separate program-controlled vault with on-chain nonce, expiry and policy enforcement.
6. Independently audit before ever enabling custody.

## Safety
No mint changes, wallet signing, treasury execution, transfers or deployment. Keep game code outside token protocol.
