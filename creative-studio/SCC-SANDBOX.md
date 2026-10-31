# SCC v0.3 — isolated credit ledger and reservation simulation

**Status: DRAFT / SANDBOX ONLY.** No real money, wallet connection, SHAH rewards, staking, cash redemption, or production access.

This module is a proposal nested within Creative Studio WP-B. It does not modify the adopted v0.6 tokenomics, the existing Studio server, the dashboard, Treasury, or SHAH allocations. Parent Draft PR #99 and stacked #101 must be reviewed separately. The SCC proposal is stacked above #101 and must not be merged before parent review.

## Functionality

- BONUS: trial promotional credit lots; optional, explicit UTC expiry. Consumption uses soonest-expiring valid bonus credits first.
- PAID_DEMO: simulated paid credit lots only. **Not proof of an order or payment.** No paid-issuance public route.
- CONSUME: legacy direct simulated usage debit; negative balance forbidden.
- RESERVE: freeze a bounded maximum amount against one account before a simulated AI call. BONUS expiring before the hold deadline is not eligible.
- RESERVATION_SETTLED: debit the actual simulated usage from the held lots, releasing all unused SCC.
- RESERVATION_RELEASED: cancel or expire the hold explicitly; returned expired bonus stays expired.
- REFUND_REQUEST: reserves unused PAID_DEMO credits for hypothetical manual review. Does not issue money, withdraw crypto, or mark a refund complete.
- REFUND_CANCEL: releases a pending simulation reservation.
- Idempotency keys and business reference IDs prevent duplicate requests in the same process; input caps and account isolation apply.
- In-memory ledger, bounded at 100 accounts / 500 events per account, max 1,000,000 SCC per transaction, and one-hour maximum reservation lifetime. It separately tracks refund-held and service-held SCC. **Restart loses all balances, holds and idempotency records.** The event trail is diagnostic, not audit-grade immutable persistence.

## Run local tests

From repository root, Node.js 20+:

```shell
node --check creative-studio/scc-ledger.mjs
node --test creative-studio/scc-ledger.test.mjs
```

No service, network or paid API is started by these commands. The tests use synthetic accounts only. The existing Studio test suite should also be run before review or merge.

## Commercial/legal release gates (all pending)

1. Validate actual AI provider unit cost, safe quotas and model-specific estimates. Do not turn on unrestricted/free generation.
2. Determine bonus credit grant criteria, expiry notices, and anti-abuse restrictions; decide policy without token-price or revenue-yield promises.
3. Determine paid credit sales, cancellation/refund obligations, and consumer disclosures with qualified Korean counsel. Use a PG only after contract and legal checks.
4. Implement authenticated multi-user identities, database transactions, reconciliation, durable idempotency, immutable audit evidence, admin controls and refund workflow.
5. Build a read-only, non-custodial SHAH eligibility preview separately; it must not transfer, lock or sign SHAH and must not automatically grant SCC until approved.
6. Obtain necessary team approvals: v0.6 is a documentation baseline; additional economic rights, budgets and enforcement are not authorized by this experiment.

## Limits

- No production issuance, no fiat/crypto settlement, no transferable SCC, no exchange rate.
- No SCC-to-SHAH redemption; no cash promise; no holder dividends or revenue sharing.
- The name SCC, unit values and expiration policy are working assumptions, not legal conclusions or customer terms.
- The event history is append-only in-memory during the process lifetime, but is not durable, tamper-resistant, or suitable for real customer accounting.

**Next stage:** private authenticated transactional database, crash/restart replay and concurrency testing, automatic expired-hold cleanup, verified provider usage, independent product economics and Korean legal review. Read-only SHAH eligibility remains a separate subsequent approval.
