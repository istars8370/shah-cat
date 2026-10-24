# SHAH CAT C3 — Falcon-512 transaction feasibility gate

Status: **EXPERIMENTAL / NOT APPROVED FOR CUSTODY**.

## Critical transaction-size constraint
Solana transactions have a serialized size limit of approximately 1232 bytes. A Falcon-512 public key is approximately 897 bytes and a signature can exceed 600 bytes. Embedding **both** in a single instruction together with a message, accounts, and transaction signatures is not viable in the normal transaction envelope. The current C3 wire format (public key + Falcon signature + message) is therefore **not a practical production transaction format**, even if `cargo build-sbf` succeeds.

## Next experiments
1. Capture the actual upstream public-key and signature lengths from A1/B2 and compare against transaction-size constraints with full serialization overhead.
2. Prototype an immutable or governed **on-chain public-key account** to avoid sending the key each time; never accept an arbitrary caller-supplied key as authorization.
3. Determine whether a Falcon signature plus instruction and account overhead fits. If not, investigate chunked upload with hash binding, strict size limits, state ownership, rent, timeout and atomic final verification. This introduces additional risks.
4. Execute valid and tampered signature tests against a local validator with an actual transaction, and capture compute units and heap/stack use.
5. Separate cryptographic validity from authorization: signed payload must bind genesis, program, vault, mint, recipient, amount, nonce, expiry and key version. Do not move funds before independent audit.

## Current evidence
- C2 SBF scaffold build succeeded according to GitHub Actions.
- C3 optional Falcon SBF compilation is a separate test; **user-reported success is not a local-validator execution proof**.
- C3 malformed-input host tests are newly added and require CI verification.
- No actual Falcon SBF transaction execution or CU benchmark is available.
- No trusted key registration or custody logic exists.

## Security
Do not deploy the C3 scaffold as a wallet or vault. It is a verifier research experiment only.
