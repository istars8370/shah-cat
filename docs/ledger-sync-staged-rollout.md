# Ledger Sync staged rollout plan (Draft PR #105)

**Status: design and test only. Do not change scheduled automation without explicit approval.**

## Target stages

1. **Read and generate:** load authoritative ledger and checkpoint from
   `automation/devnet-ledger-data`, scan Solana Devnet, validate rows.
   Do not send any Telegram messages in this stage.
2. **Publish ledger:** fast-forward-only commit of ledger, Markdown and
   checkpoints to the data branch. On conflict, stop and rerun from a fresh
   authoritative snapshot; never force-push.
3. **Reserve each notification:** identify newly added rows using the
   canonical four-field key. Read current delivery state; publish one
   `reserved` entry and verify remote commit and contents.
4. **Send:** only after reservation confirmation, invoke Telegram and validate
   `message_id` and destination chat.
5. **Acknowledge:** publish `accepted` on verified receipt, otherwise leave
   `reserved` or record `unknown`. A failed acknowledgement must never
   trigger automatic resend.
6. **Recover:** on restart, skip all `accepted`, `reserved` and `unknown`
   entries. Route unresolved entries to manual incident review.

## Important invariants

- The ledger publisher and delivery publisher share the same data branch.
  Both must use fast-forward-only updates; conflicts must be surfaced.
- A ledger publication must not reset or delete the delivery-state file.
- A notification reservation must not overwrite ledger CSV, Markdown, or
  checkpoint files.
- Never infer non-delivery from a timeout or missing acknowledgement.
- Existing legacy keys must be audited before enabling this sequence.
- Existing `ledger-sync.yml` still sends before publishing. This plan does
  **not** enable the new sequence.
- Exactly-once delivery across GitHub and Telegram is not guaranteed.

## Release gate

CI passes, local Git concurrency tests pass, data-branch audit is complete,
PR #104 overlap is reviewed, and the owner explicitly authorizes workflow
change, merge and deployment.
