# SHAH Guardian G2 — Authenticated Recovery Research Program

Status: **research only / no custody / no token movement**

## Implemented
- deterministic Guardian config PDA
- immutable config_seed + mutable current owner
- owner + mint binding
- up to 5 unique Guardian public keys
- threshold validation
- guardian-set version
- durable recovery nonce in program state
- authenticated recovery initiation using actual Solana transaction signer accounts
- current-owner authenticated cancel
- permissionless finalize after trusted Solana Clock delay
- current-owner authenticated Guardian rotation
- expiry window and replay/version checks
- fixed binary state layout
- unit tests for positive and negative state transitions

## Still not implemented
- SPL token custody
- Treasury access
- token movement
- detached signature approvals
- Falcon/PQC authorization
- Devnet deployment
- mainnet deployment

## Instruction opcodes
- 0: initialize
- 1: initiate_recovery
- 2: cancel_recovery
- 3: finalize_recovery
- 4: rotate_guardians

## Recovery timing
- minimum delay: 3600 seconds
- maximum expiry window: 7 days
- time source: Solana Clock sysvar only

## Stable PDA rule
The PDA is derived from:
- "guardian-config"
- immutable config_seed captured at initialization
- mint

Recovery may change the mutable owner but must never change config_seed.

## Security boundary
Guardian signer presence proves only that those Solana accounts signed the transaction carrying the instruction. No detached signature format is accepted in G2.

Passing unit tests is not Devnet evidence and does not authorize custody or production use.


## G3 replay/timing hardening

Additional adversarial coverage:
- canceled recovery nonce cannot be reused
- finalized recovery nonce cannot be reused
- exact executable-after boundary succeeds
- one second before executable-after fails
- exact expiry boundary fails closed
- stale Guardian-set version fails after rotation
- maximum expiry window boundary enforced

G3 remains research-only and does not add custody, token movement, detached signatures, or deployment.
