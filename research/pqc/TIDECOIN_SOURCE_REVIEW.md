# Tidecoin Falcon/FN-DSA source review — A1

Reviewed: 2026-10-22. This is a source-level feasibility review, **not** a successful cryptographic test or audit.

## Sources checked
- [Tidecoin fork README](https://github.com/tidecoin/tide-fn-dsa/blob/main/README.md)
- [Tidecoin fork workspace manifest](https://github.com/tidecoin/tide-fn-dsa/blob/main/Cargo.toml)
- [NIST ML-DSA standard](https://csrc.nist.gov/pubs/fips/204/final)

## Verified observations
1. The workspace contains `tide-fn-dsa`, `tide-fn-dsa-comm`, `tide-fn-dsa-kgen`, `tide-fn-dsa-sign`, and `tide-fn-dsa-vrfy`.
2. Workspace metadata specifies Rust >=1.82 and `Unlicense`; verify per-file attribution and transitive dependency licenses before reuse.
3. README explicitly distinguishes classic Falcon/PQClean compatibility, Tidecoin legacy Falcon-512 behavior, and an evolving FN-DSA-like profile. **These are not automatically signature-compatible.**
4. README warns its FN-DSA-like format may change and does not promise backward compatibility before version 1.0.
5. README documents degree 512 (logn=9) and 1024 (logn=10), plus smaller research-only insecure variants.
6. The README says verification uses integer arithmetic; this does **not** establish that the verifier fits Solana on-chain compute or memory limits.

## Immediate A1 experiment (off-chain only)
- Select one explicit profile and pin upstream commit SHA before implementing.
- Generate an ephemeral test key; do not use SHAH or Phantom production keys.
- Sign a fixed domain-separated test message, verify it, then test mutations of message, key and signature.
- Run profile cross-compatibility tests; log failures as expected when formats differ.
- Record exact commands, runtime versions, test vectors and results in this directory.

## B feasibility gate
Before any vault code, measure Solana BPF/SBF verifier feasibility with the **verification-only** crate and realistic signature sizes. No production asset custody or quantum-resistance claim until an independent security audit.

## Open questions
- Which upstream commit and signature profile should be pinned?
- Does the verification-only crate compile to Solana SBF without unsupported dependencies?
- What are the compute units, stack, memory and transaction size costs?
- What license notices and attributions apply to each reused file?
