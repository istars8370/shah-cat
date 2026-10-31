# SCC v0.3 — reserved-credit pricing and usage settlement (offline simulation)

**Status: DRAFT / NON-COMMERCIAL SIMULATION.** This is an extension of the SCC sandbox in PR #103, not a live price list or a service checkout. There are **no provider API calls, real billing, cash refunds, token transactions, wallet connections, staking or on-chain rewards**.

## What is implemented

- An operator-supplied, **versioned and expiring** text-model price book; unknown model IDs and non-text modalities are rejected.
- Unit-cost calculations use integer micro-USD and integer KRW/SCC rounding. Pricing takes **input, cached input and output token counts** separately, plus an operator-supplied KRW-per-USD exchange-rate input and target contribution margin.
- `preview`: computes **uncached maximum token cost**, enforces the request cap, and now **reserves** the maximum simulated SCC before returning a time-limited quote. Another request cannot spend the same held credits in this single-process sandbox.
- `settle`: validates usage, accounts and token caps, consumes only the **measured** SCC from the reserved lots, and releases the unused difference to the original BONUS / PAID_DEMO lots. Settlement is idempotent for identical inputs.
- `cancel`: when generation fails or a quote expires, explicitly releases the entire hold. A released/expired reservation cannot subsequently be settled. A quote expiry by itself **does not automatically release** a hold; no background sweep worker is implemented.
- Refund-held PAID_DEMO and service-held PAID_DEMO are separately tracked. Expired BONUS is never revived by a release.
- After settlement, the result separates `bonusDebitedScc`, `paidDemoDebitedScc`, and `releasedScc`. **None is verified cash revenue.**
- Includes synthetic unit tests and integration tests with the existing SCC in-memory ledger.

## How to verify

From repository root with Node.js 22+:

```sh
node --check creative-studio/scc-ledger.mjs
node --check creative-studio/scc-pricing.mjs
node --test creative-studio/scc-ledger.test.mjs creative-studio/scc-pricing.test.mjs creative-studio/scc-meter.integration.test.mjs
```

Existing Studio and SCC ledger tests must also pass. Tests have no live provider keys and no outgoing network calls.

## Synthetic pricing example — NOT current OpenAI prices

The unit tests model two fictitious text SKUs (`demo-basic`, `demo-plus`). In the `demo-basic` sample:

- Input: **$1 / 1,000,000 tokens**; cached input: **$0.25 / 1,000,000**; output: **$4 / 1,000,000**.
- **Illustrative** exchange rate: **1 USD = 1,400 KRW** (an input parameter, not a checked current FX rate).
- Target modeled gross margin: **20%**; **1 simulated SCC per 1 modeled KRW** for convenient integer accounting. This is **not** an exchange/redemption entitlement, money peg or approved price.
- 1,000 input tokens, of which 100 are cached, plus 500 output tokens: modeled provider cost is $0.002925, rounded to 5 KRW, then 7 **simulation SCC** at the assumed margin.

For a real product, a pricing administrator must verify exact SKU/tier, cached/write rates, long-context multipliers, region, batch/flex/fast tier, tool costs, audio/image/video usage, applicable taxes, actual FX and provider invoice. **This prototype supports standard text token pricing only.** The official provider reference for manual verification is https://developers.openai.com/api/docs/pricing ; it is not fetched by the code. Current or future prices are never asserted from the example rates.

## Important production blockers

1. Reservation now protects against spending the same simulated SCC twice **within one synchronous, in-memory Node.js instance only**. It is not durable, transactional across processes, crash safe, audited, or suitable for real money. Production requires private database transactions, durable idempotency and reconciliation before any billable provider request.
2. `settle` accepts usage from its caller in this prototype. Before production, usage must come from the authenticated server-side provider response, never the user or browser. Failed calls must not be silently charged as successes. Provider usage over quote caps needs a defined compensation policy.
3. A restart loses quotes, reservations, balances, replay protection and event history. Abandoned/expired reservations remain held until explicit `cancel`; automatic expiry, alerting and worker recovery are not implemented. It is not an invoicing ledger or consumer cash account.
4. Credits and simulated KRW/SCC conversion are **internal calculation units**. There is no tradability, cash withdrawal, token swap, service revenue share, price guarantee or assured investment return.
5. The provider cost is **estimated**, not a verified invoice. Modeled gross margin is not actual realized profit, especially for promotional BONUS SCC.
6. Paid SCC sale, refunds, expiration rules, Korean electronic finance/consumer regulations, and SHAH holder benefits require product approval and legal review. Economic rights, budgets, token supply, Treasury and on-chain state are unchanged.

**Next gate:** authenticated private transactional reservation storage (with backup, restart and concurrent-writer tests), automatic expiry/reconciliation, verified server-side provider usage, and independent Korean product/legal approvals. Only after those gates can a capped paid-provider pilot be proposed. Read-only SHAH membership eligibility remains separately gated.

## Reservation lifecycle (v0.3)

| From | Operation | To | SCC treatment |
| --- | --- | --- | --- |
| Unreserved | `preview` / `ledger.reserve` | ACTIVE | Hold conservative maximum; BONUS first, then PAID_DEMO |
| ACTIVE | `settle` / `ledger.settleReservation` | SETTLED | Spend measured cost and release the remainder |
| ACTIVE | `cancel` / `ledger.releaseReservation` | RELEASED | Return full hold |
| ACTIVE after deadline | `cancel` | EXPIRED | Return hold; already expired bonus stays expired |
| Terminal | Any new state-changing command | Rejected | No double settlement or release |

Only BONUS lots valid beyond the hold deadline can be reserved. Reservation lifetime is limited to one hour. Pricing inputs are operator-supplied examples rather than a public SCC exchange rate or a price guarantee. The old v0.2 `preview` did not reserve credits; clients testing v0.3 must use `settle` or `cancel` to close every quote.
