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

## B1 — Release manifest signature experiment

Run `cargo run --release --bin release_manifest_demo`.

This demo signs a fixed-format, domain-separated SHAH CAT Devnet manifest with an **ephemeral** Tidecoin legacy Falcon-512 key. It rejects modified payloads, incorrect network and expired manifests. The SHA-256 hash is a known **empty-file demo constant**, not a real SHAH CAT release artifact. Timestamps are fixed for deterministic tests, not live production checks.

**Not a production release signer:** it does not read or hash actual release files, persist a signing key, publish a trusted public key, manage revocation, or enforce replay protection. Never use an ephemeral demo key as an official SHAH CAT identity. Production use requires audited key management, a separately authenticated trust anchor, artifact hash calculation and independently verified manifest bytes.
