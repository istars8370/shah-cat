<!-- Historical PR #27 baseline; superseded by ../four-way-source-of-truth.md. Retained to avoid losing threat-model and acceptance criteria. -->
# SHAH CAT Four-Way Protocol — Research Architecture v0.1

Status: PROPOSAL / NOT DEPLOYED. Scope: SHAH token security infrastructure only; SHAH game development is separate.

## Thesis
Four independently testable security tracks connected through a minimal policy-controlled asset account. The project currently uses Solana Devnet. Falcon-512 is a research candidate, not evidence of quantum-resistant Solana transactions. Native Solana Ed25519 signatures remain in use; auxiliary signatures protect assets only when an enforcing program controls authorization.

## Threat model
Adversaries: stolen wallet key, compromised recovery guardian, malicious policy module, replayed approvals, altered transaction parameters, forged audit log, RPC manipulation, denial of service. Exclusions: validator consensus compromise, quantum-proof guarantee, third-party wallet assets outside protocol control.

## Common envelope
Every request MUST bind: domain separator, chain genesis/network, program ID, protected account, asset mint, action, recipient, amount, nonce, expiration, policy version, module versions, and canonical serialized payload hash. Reject cross-network replay, expired requests, duplicate nonces, unknown modules, stale policy versions and unsigned parameter changes.

## A — Adaptive Signature
- Deterministic on-chain policy gates, never solely an AI score.
- Policy tiers: ordinary, elevated, emergency; exact thresholds configurable and versioned.
- For elevated actions require approved additional signature evidence. Falcon verification feasibility and compute budget must be benchmarked; never mark off-chain verification as on-chain enforcement.
- Tests: downgrade, signature substitution, altered recipient/amount, replay, key rotation.

## B — Recovery
- Explicit enrollment, recovery guardians threshold, time delay, cancellation window, guardian rotation, recovery finalization.
- Recovery MUST invalidate old authorization state; emergency lock and unlock must follow separately defined authority.
- Tests: single rogue guardian, compromised owner, race with pending transfer, expired recovery, double finalization.

## C — Modular Execution
- Versioned module interface: validate(request, state) -> decision and evidence hash.
- Allowlist module program IDs and immutable version fingerprints; upgrades require timelock and independent approval.
- Default-deny on unavailable, unrecognized or malformed modules. Never silently bypass an optional module designated mandatory by policy.
- Tests: malicious upgrade, version mismatch, module failure, dependency cycle.

## D — Proof of Integrity
- Append-only decision records bind request hash, policy hash, signer evidence commitments, execution signature, slot and result.
- No secrets or personal data on-chain. Verify externally with reproducible open-source verifier.
- Tests: omitted events, forged approval, log tampering, mismatch between decision and execution.

## Cross-track invariants
1. No transfer without satisfying the policy version effective at authorization.
2. Every executed transfer references exactly one valid request nonce.
3. Recovery completion revokes old authority.
4. Module replacement cannot reduce mandatory policy without governance approval and timelock.
5. Audit evidence cannot itself grant execution authority.
6. Fail closed for security-critical verification errors.

## Falcon / FN-DSA research gate
Compare Falcon-512 research implementation with the finalized applicable FN-DSA standard and vetted libraries; assess signature sizes, verification compute, Solana program constraints, side channels, key storage, key rotation and algorithm agility. Do not write custom cryptographic primitives for production. Existing Falcon formats must not be assumed interchangeable. Never place private keys in repo, CI logs, browser local storage or chat.

## Integration boundaries
No edits to existing tokenomics, mint supply, treasury signing, wallet signing or DEX production paths in this proposal. Keep all experiments Devnet/local until independent review.

## Acceptance gates
G0 repository inventory + threat model; G1 four isolated deterministic prototypes; G2 integration and invariant tests; G3 external review + reproducible build + cost benchmarks; G4 explicit human-approved deployment plan. No mainnet deployment implied.
