# SHAH CAT Four-Way Protocol — Research Architecture v0.2

Status: RESEARCH / NOT DEPLOYED. Scope: SHAH token security infrastructure only; game development remains separate.

This document is the architecture source of truth for the Four-Way research stack. Implementation and evidence live under research/four-way and the associated research docs.

## Thesis
Four independently testable security tracks connected through a minimal policy-controlled asset-account design. Current work remains research-only on Solana Devnet/local environments.

## Common authorization envelope
Every protected action must bind:
- domain separator
- chain/network identity
- program ID
- protected account or vault
- mint
- action
- recipient
- amount
- nonce
- expiry
- policy version
- module versions where applicable
- key version where applicable
- canonical payload hash

Reject replay, expired requests, unknown versions, stale policy state and parameter mutation.

## Track A — Adaptive authorization
- deterministic policy gates
- no AI score as sole authority
- elevated actions require additional cryptographic evidence
- auxiliary Falcon/PQC evidence remains research-only until runtime and trust-anchor gates pass

## Track B — Recovery
- guardian quorum
- durable nonce/epoch state
- trusted timing
- cancellation/finalization policy
- guardian rotation
- freeze/unfreeze authority separation
- recovery must revoke stale authority

Current JS recovery code is behavioral simulation only. The on-chain Guardian specification governs future implementation.

## Track C — Modular execution
- versioned modules
- explicit allowlist
- fail-closed behavior
- governed upgrade path
- no silent bypass of mandatory modules

## Track D — Proof of integrity
- append-only evidence chain
- request/policy/result binding
- external reproducible verification
- evidence itself never grants authority

## Cross-track invariants
1. No protected action without satisfying the active policy version.
2. Every executed action consumes one valid nonce.
3. Recovery completion revokes stale authority.
4. Module replacement cannot silently weaken mandatory policy.
5. Audit evidence cannot grant execution authority.
6. Security-critical verification fails closed.
7. Research-only evidence must not be described as production authorization.

## Falcon / PQC gate
The current inspected SBF path explicitly targets TidecoinLegacyFalcon512 under an experimental feature. FN-DSA compatibility is not established. Legacy and FN-DSA formats must be treated as distinct until vectors and compatibility evidence prove otherwise.

Required before any authorization integration:
- pinned provenance
- test vectors
- cross-profile rejection tests
- reproducible build
- SBF resource benchmarks
- governed trust anchor
- independent review

## Acceptance gates
G0 — architecture/threat model
G1 — isolated deterministic research prototypes
G2 — integrated invariant/adversarial testing
G3 — reproducible Devnet evidence for the implemented scope
G4 — independent external review and remediation
G5 — explicit human-approved release plan

Current production/mainnet state: NO-GO.

## Source-of-truth note
This document supersedes the separate PR #27 architecture proposal once merged into the Four-Way integration branch. Detailed implementation status is tracked in docs/ops and the research runbooks.
