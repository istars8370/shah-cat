# Telegram delivery recovery protocol (draft)

This design is **not enabled** in the scheduled Ledger Sync workflow.

1. Read the authoritative delivery-state file from the data branch. Reject malformed state and refuse to send.
2. Select one pending transfer using its full transaction identity.
3. Record a `reserved` state, commit it to the data branch, and confirm the non-force push **before** calling Telegram.
4. Only after the remote reservation is confirmed, call `sendMessage`.
5. If Telegram returns a valid message receipt, replace the reservation with `accepted` and publish the update.
6. If the request times out or the result cannot be verified, leave the record as `reserved` or mark it `unknown`. Never automatically retry either state.
7. On restart, require operator reconciliation for all `reserved` and `unknown` records.

## Safety limitations

- GitHub commits and Telegram sends cannot be committed atomically across both services. Exactly-once delivery cannot be guaranteed.
- Remote branch push conflicts must stop processing; never force-push or discard the authoritative state.
- A remote reservation may block a notification indefinitely until a human resolves it. This is intentional fail-closed behavior.
- State writes should include no bot tokens or private keys.
- No changes to `main`, deployment, or existing scheduled automation are authorized.
