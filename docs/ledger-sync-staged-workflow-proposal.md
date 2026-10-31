# Ledger Sync staged workflow proposal — NOT ENABLED

The existing scheduled workflow is unchanged. This is a proposed sequence for a separately approved future revision.

## Stage 1 — Read and generate (no remote writes)
- Fetch the authoritative ledger data branch. Fail if the branch cannot be read.
- Read existing CSV, checkpoint, and delivery state. Reject malformed or legacy delivery keys.
- Scan Devnet and merge ledger rows. Do not advance checkpoint for an unverified transaction.
- Produce a proposed ledger commit and list of newly observed transfer identities.

## Stage 2 — Persist ledger (no Telegram sends)
- Publish CSV, Markdown and checkpoint to the data branch using non-force fast-forward semantics.
- Re-read remote commit and verify the generated content.
- On a conflict, restart from a fresh authoritative snapshot; never overwrite another writer's data.

## Stage 3 — Reserve each notification (no Telegram sends yet)
- For each canonical transfer key, check accepted/reserved/unknown state.
- Persist a reserved record to the data branch and verify remote commit and content.
- If reservation cannot be confirmed, stop without sending.

## Stage 4 — Send one message and reconcile
- Send only the previously confirmed reserved transfer using the validated channel.
- If Telegram returns a valid message ID/chat identity, persist accepted.
- On timeout, malformed receipt, failed acknowledgement push, or process crash,
  preserve reserved/unknown and require manual reconciliation; never auto-resend.

## Coordination and concurrency
- The ledger writer and notification writer target the SAME data branch. Both must
  fetch fresh tips and push without force. A rejected push must not be retried
  against a stale base.
- The current workflow uses `cancel-in-progress: true`; cancellation between
  remote reservation and send can leave a reserved record. This is fail-closed,
  but may require manual intervention.
- Separate runs may interleave; a successful push must not be interpreted as
  proof of Telegram delivery.
- A one-time rollout needs an approved initial delivery-state baseline to avoid
  re-alerting historical transfers.

## Release blockers
1. Implement and test this sequence as an opt-in workflow on a separate branch.
2. Test crash points after every remote write and before/after Telegram calls.
3. Reconcile Telegram PR #104 and review channel authorization.
4. Obtain explicit approval before modifying the scheduled workflow on main.
