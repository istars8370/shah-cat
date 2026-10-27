# Devnet Validation Plan

Updated: 2026-10-27 KST

## Purpose
Create reproducible Devnet evidence without expanding scope into mainnet or claiming that a basic network transfer validates Guardian, Falcon/PQC, Treasury, or SHAH custody behavior.

## Phase D0 — Read-only environment check
Scope:
- verify expected Devnet identity
- inspect slot/version
- confirm RPC response integrity using existing research tooling

Expected result:
- network identity and response validation PASS

Evidence:
- commit SHA
- command/output transcript
- timestamp
- no secrets

Failure:
- stop; do not execute later phases until RPC/network mismatch is resolved

## Phase D1 — Basic SOL smoke test
Scope:
- new disposable Devnet-only keypair
- faucet-funded SOL
- small SOL transfer to a separate Devnet recipient
- finalized receipt verification

Expected result:
- transaction finalized on Devnet
- independent receipt check matches transaction identity and network

Evidence:
- public transaction signature
- confirmation output
- receipt verifier result

Limit:
- proves basic Devnet transaction path only
- does not validate SHAH, Guardian, Falcon/PQC, Treasury, or custody

## Phase D2 — Program-specific validation
Status: **BLOCKED until an approved Guardian/program implementation exists**

Scope when unblocked:
- deploy or identify the approved Devnet program build
- execute positive path
- execute required rejection/adversarial paths
- verify state transition and replay/timing behavior

Expected result:
- positive case succeeds exactly as specified
- negative cases fail for the expected reason

Evidence:
- program ID
- source/build identity
- transaction signatures
- before/after state
- test output

## Phase D3 — SHAH/custody integration validation
Status: **BLOCKED**

Requires:
- approved program-controlled custody design
- explicit integration PR
- isolated Devnet assets only
- prior release gates satisfied for the tested scope

Do not use Treasury or production assets for this phase.

## Evidence record template
For every execution record:
- Date/time KST
- Git commit
- Branch
- Test phase
- Network
- Program ID if applicable
- Public transaction signature
- Expected result
- Actual result
- PASS/FAIL
- Limitations
- Links to logs/evidence

## Stop conditions
Stop immediately if:
- network identity differs
- required code/commit cannot be identified
- validation would require a production key or real funds
- scope expands beyond the approved phase
- expected negative tests cannot be safely reproduced

## Current next executable step
D0 is executable now.
D1 is executable as an isolated basic Devnet smoke test using a fresh disposable Devnet-only key.
D2 and D3 remain BLOCKED.
