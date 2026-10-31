# Telegram Delivery Incident Response — operator runbook

**Status:** Draft only. No production automation has been changed.

## 1. Freeze automated retries
Do not delete, clear, or overwrite `docs/devnet-telegram-delivery.json`.
Never retry a `reserved` or `unknown` transfer automatically. A timeout
may mean Telegram accepted the message but its response was lost.

## 2. Gather evidence
1. Record the transaction signature, sender, recipient, amount, and canonical
   JSON tuple key `[signature,sender,recipient,amount]`.
2. Record the authoritative commit SHA on
   `automation/devnet-ledger-data` and preserve the corresponding delivery
   state entry, GitHub Actions run URL, UTC timestamps, and Telegram channel.
3. Search the destination channel for the exact transfer signature and compare
   the message body, amount, sender, and recipient. A signature alone is not
   sufficient if a transaction contains multiple transfer rows.
4. Confirm whether a Telegram `message_id` and `chat_id` were recorded.
   Never copy bot tokens, API secrets, or private keys into the incident report.

## 3. Decide the disposition
- `accepted` with matching message ID and channel: retain the record;
  do not resend.
- `reserved` or `unknown`, matching channel message verified: document
  the evidence and request a separately reviewed correction to `accepted`.
- `reserved` or `unknown`, no message found: **absence of a visible
  message is not proof of non-delivery**. Hold for review; any deliberate
  resend needs explicit operator approval and a documented duplicate risk.
- Invalid key, missing history, unexpected branch change, or malformed state:
  stop processing. Restore only from a verified historical commit after review.

## 4. Change control
1. Propose the exact before/after entry, supporting evidence, and approver.
2. Re-read the authoritative remote commit immediately before a correction.
3. Reject the correction if the remote commit or state has changed.
4. Apply only the approved entry; preserve all unrelated entries.
5. Verify the resulting remote commit and archive the incident record.

## 5. Release gate
Do not enable the coordinator in the scheduled workflow until the legacy
key audit, cross-workflow concurrency checks, recovery tests, PR #104 overlap
review, and explicit merge/deployment approval are complete.

Telegram and GitHub cannot provide cross-service exactly-once delivery.
