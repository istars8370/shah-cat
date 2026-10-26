# SHAH CAT NOW

Updated: 2026-10-27 KST

Maximum 3 active high-priority work packages.

## Current cycle finding

### Guardian G2 implementation — PAUSED by prerequisite design fix
During G2 implementation review, a structural issue was found:

- G1 config PDA was derived from mutable owner + mint.
- G2 recovery changes owner.
- After recovery, the persisted owner could no longer match the original PDA seed identity.

This is not acceptable as a long-term recovery design.

### Fix implemented
Evidence:
- PR #56
- Guardian state version 2
- immutable config_seed added
- mutable owner remains separate
- state size updated
- tests updated
- README documents stable PDA derivation rule

Current status:
- PR #56 open / draft / mergeable
- CI evidence pending

## P0 — active

### 1. Validate PR #56 stable PDA fix
Done when:
- Guardian CI PASS
- SHAH CAT CI PASS
- state round-trip and layout tests PASS
- config_seed remains immutable across future owner recovery

### 2. Guardian G2 implementation
BLOCKED until #56 validation passes.

Then implement:
- initiate_recovery
- cancel_recovery
- finalize_recovery
- rotate_guardians
- Clock sysvar
- nonce/version binding
- negative tests

Still no token movement.

### 3. PR #53 architecture integration
Goal:
- accept reconciled Four-Way architecture source of truth
- supersede PR #27 after review

## P1
- Falcon evidence package
- clean Solana deprecation/cfg warnings
- Devnet D0 read-only validation
- Devnet D1 disposable SOL smoke test

## HOLD
- Guardian token custody
- Treasury integration
- Falcon authorization integration
- DEX expansion
- mainnet
