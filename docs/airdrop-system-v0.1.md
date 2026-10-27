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

## Next integration step

After this isolated engine is reviewed:

1. add a local application store with append-only audit events;
2. expose read/write Airdrop API routes from the local dashboard;
3. build the Airdrop admin screen;
4. export proposed payouts to the existing Treasury request workflow;
5. add Devnet-only batch preparation after independent review.

Actual signing/broadcasting remains out of scope until separately authorized.
