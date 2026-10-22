# SHAH CAT A1 — Tidecoin legacy Falcon-512 off-chain proof of concept

**Unexecuted research code. NOT audited. No asset custody.**

This example follows the public Tidecoin `tide-fn-dsa` Rust API and generates ephemeral keys using the operating-system CSPRNG. It signs a domain-separated demo message, verifies it, and checks two tampering cases. It does not modify SHAH CAT tokens or Solana transactions.

## Before running

1. Review the upstream repository and select an exact trusted commit SHA.
2. Replace `REPLACE_WITH_REVIEWED_COMMIT` in Cargo.toml with that SHA. This is intentionally not a floating dependency.
3. Install Rust 1.82+ and run from this directory:

```sh
cargo run --release
```

Expected successful output begins with `PASS: valid signature accepted`. This has **not yet been executed or independently verified**.

## Required follow-up

- Confirm compile and API compatibility at the pinned commit.
- Add wrong-public-key, truncated-signature, and cross-profile tests.
- Review transitive licenses and dependencies.
- Evaluate the verifier-only crate for Solana SBF; no vault until measured.
- For production manifest signing, replace the demo string with an unambiguous canonical serialization and anti-replay policy.
