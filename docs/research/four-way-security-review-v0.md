# Four-Way internal security review — NOT independent audit

Status: **NO-GO for production**. The following are confirmed design gaps, not claims of exploitation:
1. Legacy Falcon profile is experimental; reproducible vectors and Solana runtime verification absent.
2. Guardian identities and administrative approval booleans are not authenticated in research prototypes.
3. Nonces and audit records are local memory rather than on-chain or durable.
4. Timelocks use caller-provided time; module metadata hashes are not executable code attestations.
5. Audit hash chains can be rewritten alongside attacker-controlled checkpoints.
6. No audited SPL custody vault or proven Devnet transaction path.

PR #45 provides a conservative gate and tests. It does **not** remediate these blockers or replace an external audit. Do not merge research prototypes into a live authorization path.
