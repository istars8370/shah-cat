# SHAH CAT C5 — Program-owned Falcon public key account (experimental)

C5 adds a **read-only** signature-verification instruction to the existing `falcon-experimental` feature. No key account is created or initialized by this program. No tokens move.

## Instruction
`53 43 01 02 | signature_length: u16 LE | message_length: u16 LE | signature | message`

The first account must be owned by the executing program and must be read-only. Account data must be exactly `SCK1 | public_key_length: u16 LE | public_key`. Any absent, malformed, incorrectly owned or writable key account is rejected.

## Important security limitations
- No authorized registration, initialization, rotation, revocation or freeze procedure exists. Do not treat arbitrary program-owned account bytes as an official SHAH CAT key.
- There is no binding to a trusted vault, mint, domain, nonce or expiry. Signature validity is **not** withdrawal authorization.
- A successful SBF compilation does not establish local-validator execution, compute-unit feasibility, or packet-size viability.
- Key-account provisioning must have immutable/authorized governance and explicit trusted account identity; the program currently accepts any well-formed account owned by itself.
- A single signature plus Solana transaction overhead may still exceed the 1232-byte limit. Measure actual serialized transactions.
- The program is research-only; never deposit assets or use it for production custody.

## Next validation gates
1. Confirm C5 host tests and SBF build pass in GitHub Actions.
2. Add deterministic test-only key-account provisioning and a local-validator integration test for a valid signature, invalid signature, wrong account owner, wrong account identity and malformed payload.
3. Record actual serialized transaction bytes, CU, heap, stack and deployment size. Stop if limits are exceeded.
4. Design secure key lifecycle and audited vault authorization separately.
