# Guardian Integration Gap Map

Updated: 2026-10-27 KST

Compared:
- research/four-way/guardian-recovery.mjs
- research/four-way/recovery-controls.mjs
- research/four-way/replay-guard.mjs
- docs/research/four-way-onchain-guardian-spec-v0.md

## Verdict
**BLOCKED for on-chain validation.**

The current JavaScript code is useful as a behavioral prototype, but it is not an implementable authority layer for Devnet custody or recovery.

## Gap matrix
| Requirement | Current state | Verdict | Note |
|---|---|---|---|
| Guardian threshold logic | JS list/quorum checks | IMPLEMENTED as simulation | identities are strings, not cryptographic signer proofs |
| Distinct guardians | JS duplicate rejection | IMPLEMENTED as simulation | not bound to transaction signer accounts |
| Recovery nonce | string nonce + in-memory list | PARTIAL | not durable/on-chain |
| Replay protection | in-memory sets | PARTIAL | lost on process restart |
| Timelock | caller-provided integer now | PARTIAL | not trusted Clock sysvar |
| Recovery epoch | integer epoch in JS state | PARTIAL | not persisted in program account |
| Freeze | boolean in JS state | PARTIAL | no authenticated authority |
| Unfreeze approval | caller boolean | FAIL for authority | not cryptographically authenticated |
| Cancel recovery | unconditional if pending | FAIL for authority | missing authenticated caller policy |
| Guardian rotation | JS state mutation | PARTIAL | no authenticated governance or PDA state |
| PDA vault config | absent | MISSING | required for program-controlled custody |
| SPL vault authority | absent | MISSING | no program custody path |
| Owner / mint binding | absent in Guardian state machine | MISSING | required in on-chain spec |
| Guardian-set version | epoch-like concept only | PARTIAL | must be explicit and persistent |
| Trusted timing | absent | MISSING | must use Solana clock source |
| Program/network binding | absent in recovery approvals | MISSING | required for cross-context replay defense |
| Expiry | absent | MISSING | required by spec |
| Authenticated cancel/finalize | absent | MISSING | current functions trust caller |
| Devnet program deployment | absent | MISSING | no program ID/build evidence |
| Positive on-chain recovery tx | absent | MISSING | not yet testable |
| Negative on-chain attack tests | absent | MISSING | only local JS tests exist |

## Minimal Devnet implementation sequence
### G1 — State-only Solana program skeleton
Implement vault/config PDA, owner, mint, guardian keys, threshold, guardian-set version, recovery nonce, pending owner, timing fields and freeze state. No token movement yet.

### G2 — Authenticated recovery instructions
Implement initialize, initiate_recovery, cancel_recovery, finalize_recovery and rotate_guardians using actual signer accounts or rigorously verified signed evidence.

### G3 — Replay/timing enforcement
Require on-chain nonce state, guardian-set version, trusted Clock sysvar, expiry and stale-epoch rejection.

### G4 — Local validator adversarial suite
Minimum negative cases: one signer, duplicated guardian, outsider guardian, stale nonce, old guardian-set version, early finalize, expired recovery, frozen state, unauthorized cancel, rotation during pending recovery and double finalize.

### G5 — Devnet deployment evidence
After G1-G4, record program ID/build identity and positive/negative public transaction evidence.

### G6 — Custody integration
Separate later gate. Do not add SPL custody until recovery state/authentication is independently validated.

## Result
Guardian status: **BLOCKED**

Next engineering action: build G1 state-only program skeleton in a separate branch/PR. Do not connect it to Treasury or production assets.
