# SHAH CAT — Release Gate 2 (Devnet-only transfer readiness)

Status: **Draft implementation for review.** This work introduces *read-only* transfer readiness checks, NOT a transaction implementation or Mainnet readiness.

## Scope in this PR

- New \`GET /api/preflight?sender=...&recipient=...&amount=...\` endpoint, only on localhost.
- Fail closed unless the RPC genesis hash is Solana Devnet.
- Verify address syntax, distinct sender and recipient, non-zero uint64 SHAH amounts (9 decimals).
- Fetch source SOL and parsed SHAH token accounts at \`confirmed\`.
- Refuse frozen, unexpected mint/owner/precision, and insufficient single source token account.
- Apply conservative **0.01 Devnet SOL reserve policy**, explicitly **not** an actual transaction fee calculation.
- Show the read-only result in the browser; invalidate asynchronous results when accounts/inputs change.
- Offline deterministic tests using mocked RPC responses.

## Explicit limitations

A successful check means **a transaction may be constructed later**, not that a send will succeed.

- Recipient associated token account existence, correct owner curve, rent and creation fee are **not** checked.
- No blockhash, simulated instructions, fee estimate, transaction message or durable nonce.
- Delegations and alternative token programs are out of scope.
- Balance snapshot can change before a transaction.
- **No private keys, signing, \`signAndSendTransaction\`, \`sendTransaction\`, \`sendRawTransaction\`, or real transfers.**
- Mint/Freeze Authority remains unchanged. **No Mainnet deployment.**

## Future approval gates (separate PR)

1. Define intended destination model: recipient owner wallet vs existing SHAH token account.
2. Verify legacy SPL token program vs Token-2022 program from mint owner, ATA derivation, on-curve and existing account state.
3. Build transactions using version-pinned, locally bundled audited libraries; never import unpinned code from a CDN.
4. Simulate unsigned Devnet instructions and obtain actual estimated fees/rent.
5. Human visibly confirms sender, recipient, amount, network, and optional ATA creation **before Phantom signature**.
6. Request Phantom signature **only after explicit per-transfer user action** and revalidate connected wallet and Devnet.
7. Confirm the chain receipt and ensure idempotent transfer state; include timeout, account change, network mismatch and reject tests.
8. Obtain explicit separate authorization for test transfers and later for Mainnet. No automatic deployment.

## Review instructions

\`\`\`sh
node --test dashboard/*.test.mjs
node dashboard/server.mjs
\`\`\`

Open \`http://127.0.0.1:4173\` in a supported browser with Phantom. The read-only button should respond without opening a Phantom signing prompt. Confirm that account switching, input changes, and disconnects invalidate stale results.
