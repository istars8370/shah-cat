# On-chain Guardian Recovery: implementation specification (NOT IMPLEMENTED)

## Threat model
A malicious caller may spoof guardian identifiers, race recovery, reuse approvals, tamper with client clocks, rotate the guardian set, or replay approvals across programs and chains.

## Required program state
- PDA vault configuration bound to owner, token mint, SPL vault authority, guardian set and threshold.
- Guardian set version and unique guardian public keys; bounded sizes and checked arithmetic.
- Monotonically increasing recovery nonce, pending target owner, initiation slot/timestamp, executable-after timestamp, expiry and cancellation status.
- Emergency freeze flag; role separation for freeze, unfreeze and guardian rotation.
- Explicit upgrade authority and immutable or timelocked governance policy.

## Instruction requirements
- initialize: authenticated owner; fresh PDA; validated guardian uniqueness and threshold.
- initiate_recovery: cryptographically authenticate threshold distinct guardian signers through actual Solana transaction signer accounts or rigorously verified signed instruction evidence. Bind approvals to genesis/network, program ID, vault PDA, target owner, nonce, expiry, guardian-set version and action.
- cancel_recovery: current owner or authenticated authorized recovery cancellation policy.
- finalize_recovery: trusted Clock sysvar timelock, current nonce/epoch, no freeze, matching pending target; atomic state transition.
- rotate_guardians: authenticated policy, no pending recovery, guardian version increment.
- transfer: if introduced later, enforce program-derived vault authority and all checks ON CHAIN, not via an off-chain boolean.

## Required tests before claiming success
1. Positive: two distinct authorized guardian signers initiate, timelock passes, new owner takes control.
2. Negative: single signer, duplicated signer, outsider signer, wrong vault/program/mint/network, expired approval, stale epoch, nonce replay, early finalize, frozen vault, concurrent finalize, unauthorized cancel, unsafe rotation.
3. SPL token custody: confirm old owner cannot withdraw after successful recovery and new owner can only act within defined policy.
4. Local validator + deployed Devnet program ID, source/build hash, signed transaction receipts and independent test replication.

No audited on-chain program is included in this PR. The prior JavaScript recovery prototype must not be treated as an authority.
