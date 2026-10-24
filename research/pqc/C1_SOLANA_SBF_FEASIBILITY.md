# SHAH CAT C1 — Solana Falcon verifier feasibility

**Research only; no vault and no on-chain quantum protection.**

## Objective
Determine whether the Tidecoin legacy Falcon-512 **verification-only** code can be compiled for Solana SBF and fit Solana transaction, memory, and compute limits.

## Reproducible investigation sequence
1. Pin the exact Tidecoin upstream commit and select the legacy Falcon-512 wire format. Do not confuse it with FN-DSA.
2. Install a supported Solana/Agave toolchain, record `solana --version`, `cargo --version`, `rustc --version`, and `cargo build-sbf --version`.
3. Create a minimal Solana SBF program that verifies a fixed known-good signature with a hard-coded *public* key and payload. Never embed a secret key.
4. Use a verifier-only crate. Remove key generation, OS RNG, filesystem, standard-library and unsupported system dependencies from the on-chain build.
5. Execute a local validator/Devnet test and capture compute units consumed, transaction byte length, deployed program binary size, heap and stack usage.
6. Repeat for wrong key, modified message, malformed signature, replayed nonce, and oversized input. Record failure codes and compare them to off-chain reference behavior.
7. If the verifier cannot fit within budget or cannot compile safely, **stop** and document the blocker rather than silently substituting an off-chain trusted service.

## Acceptance evidence
- Exact source commit and dependency lockfile
- A working `cargo build-sbf` output
- Transaction signature and reproducible local/Devnet test logs
- Measured compute, heap, stack and transaction sizes
- Explicit threat model and independent security review before any funds

## Current C1 state
**Not yet compiled or deployed to Solana SBF. No benchmark numbers exist.**
The off-chain A1/B1/B2 tests cannot prove on-chain feasibility.

## Solana vault prerequisites
A future vault must own token accounts via a program-derived authority and verify authorization *on-chain*. Signed payload must bind genesis hash, program ID, vault ID, token mint, destination, amount, nonce, expiry and key version. Nonce must be stored and consumed atomically.

## C2 — First SBF compilation attempt
- Workflow: `.github/workflows/shah-pqc-c2-sbf.yml` installs the Solana CLI and invokes `cargo build-sbf` for `research/pqc/c1-sbf`.
- The initial program intentionally rejects every instruction; a successful build **does not** mean Falcon-512 can run on-chain.
- The workflow reports the .so binary size if compilation succeeds. It does **not** report compute units, heap, stack, transaction size, or Falcon verification performance.
- This initial exploratory workflow installs the upstream **stable** CLI; pin a reviewed release and record exact toolchain versions before calling builds reproducible.
- C2 gate remains **OPEN** until a verified Falcon-512 implementation builds for SBF, accepts known-good signatures, rejects malformed signatures, and has reproducible local validator benchmarks.
