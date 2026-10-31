# SCC v0.2 — model-cost pricing and metering (offline simulation)

**Status: DRAFT / NON-COMMERCIAL SIMULATION.** This is an extension of the SCC sandbox in PR #103, not a live price list or a service checkout. There are **no provider API calls, real billing, cash refunds, token transactions, wallet connections, staking or on-chain rewards**.

## What is implemented

- An operator-supplied, **versioned and expiring** text-model price book; unknown model IDs and non-text modalities are rejected.
- Unit-cost calculations use integer micro-USD and integer KRW/SCC rounding. Pricing takes **input, cached input and output token counts** separately, plus an operator-supplied KRW-per-USD exchange-rate input and target contribution margin.
- `preview`: checks the current sandbox balance against the **uncached maximum token cost**, enforces a per-request SCC cap, and returns a time-limited simulated price quote. **No credit hold or reservation is made.**
- `settle`: takes the usage counts supplied by the local test harness, validates the quoted account/model/token limits, and sends one idempotent credit debit to `scc-ledger.mjs`. Bonus credits remain consumed before paid-demo credits by the existing ledger.
- After settlement, the result separates `bonusDebitedScc` and `paidDemoDebitedScc`. **Neither equals verified cash revenue.**
- Includes synthetic unit tests and integration tests with the existing SCC in-memory ledger.

## How to verify

From repository root with Node.js 22+:

```sh
node --check creative-studio/scc-pricing.mjs
node --test creative-studio/scc-pricing.test.mjs creative-studio/scc-meter.integration.test.mjs
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

1. **Never call a billable AI API after the current preflight alone.** There is no atomic balance reservation. Another operation may consume SCC between preview and settlement, leaving unrecoverable provider costs. Real operation requires durable reservations, expiry/release, reconciliation and transactional accounting first.
2. `settle` accepts usage from its caller in this prototype. Before production, usage must come from the authenticated server-side provider response, never the user or browser. Failed calls must not be silently charged as successes. Provider usage over quote caps needs a defined compensation policy.
3. This is in-memory and single-process only. Restarts lose quotes, balances, replay protection and audit history. It is not an invoicing ledger or a consumer cash balance system.
4. Credits and simulated KRW/SCC conversion are **internal calculation units**. There is no tradability, cash withdrawal, token swap, service revenue share, price guarantee or assured investment return.
5. The provider cost is **estimated**, not a verified invoice. Modeled gross margin is not actual realized profit, especially for promotional BONUS SCC.
6. Paid SCC sale, refunds, expiration rules, Korean electronic finance/consumer regulations, and SHAH holder benefits require product approval and legal review. Economic rights, budgets, token supply, Treasury and on-chain state are unchanged.

**Next gate:** durable private reservation/reconciliation engine and actual verified provider cost ingestion. Only after that, controlled paid-provider testing with a hard KRW budget. Read-only SHAH member eligibility remains a later, separately approved feature.