# Telegram delivery release gate (Draft PR #105)

Status: NOT APPROVED FOR PRODUCTION.

## Blocking checks
- [ ] Latest CI (including delivery adapter and key collision tests) passes.
- [ ] Confirm that `automation/devnet-ledger-data` has no existing delivery state using legacy pipe-separated keys, or provide a tested migration. Never silently reset existing delivery state.
- [ ] Reconcile existing Ledger Sync's signature-only new-transfer filter with the composite identity used by the delivery coordinator.
- [ ] Integrate coordinator into the notifier **only after** remote reservation has been committed and reread.
- [ ] Verify push rejection, post-push confirmation failure, Telegram timeout, and crash after remote reservation.
- [ ] Verify that concurrent ledger publisher and Telegram publisher cannot overwrite one another's data.
- [ ] Validate Telegram response chat identity for both numeric IDs and @channel aliases.
- [ ] Review and reconcile overlap with Telegram PR #104.
- [ ] Obtain explicit approval before altering the scheduled workflow, merging to main, or deploying.

## Recovery policy
A remote `reserved` or `unknown` state is not an instruction to retry.
An operator must inspect the target Telegram channel and the remote commit
history before choosing any manual correction. Telegram sendMessage has no
cross-service exactly-once transaction with Git.

## Non-goals
This draft does not send real messages, migrate production records, or
change the existing scheduled automation.
