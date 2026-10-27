# Integrity evidence gate

The proof-of-integrity prototype creates a SHA-256 hash chain for off-chain decision metadata. It is NOT a blockchain, immutable log, signed attestation, trusted timestamp, or independent proof of execution.

Threats: a malicious operator can rewrite the entire history and recompute all hashes; the verifier cannot detect that without an externally authenticated checkpoint. Audit records are not persisted, nor linked to actual Solana receipts.

Production requirements: canonical serialization, persistent append-only store, signed checkpoint/independent anchoring, retention policy, privacy controls, chain receipt reconciliation and adversarial verification.
