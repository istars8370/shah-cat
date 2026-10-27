# SHAH CAT Airdrop System v0.1

Status: implementation draft in PR #91.  
Scope: local deterministic application screening and payout-proposal engine only.

## Safety boundary

v0.1 does **not** sign, broadcast, transfer, custody or move SHAH. It does not store a seed phrase/private key and does not bypass the existing Treasury approval policy.

The first release automates the repetitive work before payment:

1. validate a submitted Solana public address and evidence metadata;
2. enforce the Genesis campaign window and intake caps;
3. classify obvious duplicate/abusive submissions as PASS / REVIEW / REJECT;
4. calculate contribution scores;
5. create a bounded payout proposal;
6. require a human/Treasury approval step before any future transfer implementation.

## Genesis defaults

| Control | v0.1 default |
| --- | ---: |
| Campaign length | 30 days |
| Total payout ceiling | 2,000,000 SHAH |
| Supply share | 0.2% of 1,000,000,000 SHAH |
| Application hard cap | 2,000 |
| Daily new-application cap | 150 |
| Daily payout-proposal cap | 100,000 SHAH |
| General per-recipient cap | 2% of campaign budget |
| Automatic transfer | Disabled |

The campaign ends when the first hard condition is reached: time limit, 2,000 applications, or the 2,000,000 SHAH allocation ceiling.

## Files

- `dashboard/airdrop-engine.mjs`: pure policy/validation/scoring/payout-proposal engine.
- `dashboard/airdrop-engine.test.mjs`: offline Node tests.
- `docs/airdrop-policy-v1.0-ko.md`: public policy and Genesis limits.

## Classification

### PASS

Basic deterministic checks passed and no risk flag needs manual review.

### REVIEW

Potentially legitimate submission that needs judgment, such as security reports, GitHub contribution claims, high-value claims or suspicious shared-device/content patterns.

### REJECT

Invalid wallet/input, expired campaign, duplicate wallet/community ID/evidence in the current batch, hard-cap exhaustion or explicit abuse flag.

The current-batch duplicate check is not a full Sybil-defense system. A persistent application store and privacy-reviewed anti-abuse signals are required before public launch.

## Implemented integration

The v0.1 branch now also includes:

1. an append-only local JSONL application ledger with a SHA-256 hash chain;
2. localhost-only Airdrop API routes;
3. a local Airdrop admin screen linked from the Dashboard;
4. PASS / REVIEW / REJECT counts and application ledger view;
5. payout proposal preview;
6. Treasury proposal JSON export.

The Treasury export is deliberately a **template**, not an executable request. It leaves `budgetId` unset because an actual spend request requires a separately approved Treasury budget.

## Remaining before public launch

1. add operator review actions for REVIEW cases and record those decisions append-only;
2. add a public application form separated from the local admin interface;
3. add privacy-reviewed persistent Sybil controls beyond wallet/community/evidence duplication;
4. verify load behavior near the 150/day and 2,000 total caps;
5. review the Treasury handoff against an actually approved campaign budget;
6. only then consider Devnet batch transaction preparation.

Actual signing/broadcasting remains out of scope until separately authorized.
