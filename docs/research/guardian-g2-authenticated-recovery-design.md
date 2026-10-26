# SHAH Guardian G2 — Authenticated Recovery Design

Status: DESIGN ONLY / NOT IMPLEMENTED

Base:
- Guardian G1 state-only research program
- no token movement
- no Treasury integration
- no Falcon/PQC authorization
- no mainnet

## Objective
Define the minimum authenticated recovery instruction set that can be implemented and tested without adding token custody.

## Instructions

### initiate_recovery
Required accounts:
1. Guardian config PDA — writable
2. proposed new owner — read-only identity
3. Clock sysvar
4. threshold number of distinct Guardian signer accounts

Validation:
- config account owned by Guardian program
- state version supported
- not frozen
- no recovery currently active
- Guardian signer set contains no duplicates
- every signer belongs to the active Guardian set
- signer count >= threshold
- proposed owner is non-default and differs from current owner
- supplied recovery nonce equals current state recovery_nonce + 1
- Guardian-set version matches active state
- expiry is after executable-after and both are based on trusted Clock
- approvals are bound to this program/config/new-owner/nonce/version/expiry

State transition:
- recovery_active = true
- pending_owner = proposed owner
- initiated_at = Clock.unix_timestamp
- executable_after = initiated_at + configured delay
- expires_at = explicit bounded expiry
- recovery_nonce = supplied nonce

### cancel_recovery
Authorized caller:
- current owner signer

Validation:
- recovery_active = true
- current owner matches persisted owner
- caller signed transaction

State transition:
- clear pending recovery fields
- do not decrement recovery_nonce

### finalize_recovery
Authorized execution:
- permissionless finalization is acceptable only if all state checks are sufficient; otherwise require an explicitly documented signer.
- preferred G2 design: permissionless finalize after authenticated initiation.

Validation:
- recovery_active = true
- not frozen
- Clock >= executable_after
- Clock < expires_at
- pending owner non-default
- Guardian-set version and recovery nonce state unchanged since initiation

State transition:
- owner = pending_owner
- clear pending recovery fields
- guardian_set_version unchanged
- recovery_nonce remains consumed

### rotate_guardians
Authorized caller:
- current owner signer

Validation:
- no active recovery
- unique non-default Guardian keys
- 2 <= threshold <= guardian_count
- guardian_count <= MAX_GUARDIANS

State transition:
- replace Guardian set
- threshold updated
- guardian_set_version += 1

## Replay and domain binding

G2 must not treat raw signer presence as portable approval evidence.

For direct Solana transaction signer accounts:
- signer identity is bound to the transaction itself
- state must still bind recovery to config PDA, program ID, nonce and Guardian-set version

If detached signatures are introduced later:
- define a canonical message before implementation
- bind domain, cluster/genesis, program ID, config PDA, pending owner, nonce, Guardian-set version, executable-after, expiry and action
- do not reuse a signature format from Falcon/PQC work implicitly

## Timing
Use the Solana Clock sysvar only.

Do not accept caller-provided wall-clock time.

Recommended constraints:
- minimum recovery delay: configuration constant or persisted config
- bounded maximum expiry window
- reject negative/overflowing timestamp arithmetic

## Failure cases to test

initiate_recovery:
- one Guardian only below threshold
- duplicate signer
- outsider signer
- stale Guardian-set version
- stale/reused nonce
- same owner target
- default target
- already pending
- frozen config
- malformed expiry
- arithmetic overflow

cancel_recovery:
- outsider caller
- old owner after finalized recovery
- no pending recovery

finalize_recovery:
- early finalize
- expired recovery
- frozen config
- no pending recovery
- state mutation between initiation/finalization
- double finalize

rotate_guardians:
- outsider caller
- duplicate Guardian
- threshold too low/high
- active recovery
- too many Guardians

## G2 acceptance gate
G2 may be marked DONE for research scope only when:
1. instructions are implemented against G1 state,
2. unit tests cover all state transitions,
3. negative tests cover the cases above,
4. CI passes,
5. no token custody or transfer logic is introduced,
6. state layout/version migration is explicitly handled if G1 layout changes.

## Known deferred items
Deferred to later gates:
- SPL vault custody
- recovery-driven token authority change
- detached signature approvals
- Falcon/PQC approval evidence
- Devnet deployment
- independent external audit
- mainnet
