# Integrity adversarial research

A hash chain alone cannot prove historical truth. If an attacker can replace all records and the checkpoint, verification succeeds on forged history. Checkpoints must be authenticated out-of-band, preferably signed and independently retained. No actual Solana transaction receipt or custody is proved here.

Release blocker: implement canonical bytes, external trust anchor, persistent audit log and receipt reconciliation. The tests are written but not yet executed.
