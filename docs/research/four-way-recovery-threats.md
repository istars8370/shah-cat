# Four-Way recovery adversarial research gate

## Covered by proposed unit tests
- Outsider guardian, insufficient quorum, duplicate/replayed nonce, early finalization, frozen state, rotation during pending recovery, immutable state.

## Critical missing security controls
- Guardian identifiers in this research code are plain strings, not verified signatures. An attacker can spoof them.
- Emergency freeze/unfreeze approvals are unauthenticated booleans. A caller can spoof approval.
- Nonce state is in-memory / passed in as plain objects, not durable or on-chain.
- Recovery timelock depends on caller-provided time, not trusted Solana clock.
- No atomic storage, consensus, PDA authority, verified governance, deployment, audit, or protection of SPL tokens.

## Release blocker
DO NOT enable real custody, withdrawals or public security claims until an on-chain state machine with authenticated guardians and audited authorization passes integration and adversarial testing.

Run proposed tests from repository root: `node --test research/four-way/*.test.mjs`. Actual CI execution must be checked independently.
