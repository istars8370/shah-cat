# SHAH CAT Airdrop Devnet Batch Draft v0.1

Status: implemented as a non-transactional payout preparation layer.

## Purpose

This layer converts payout-eligible Airdrop applications into a deterministic Devnet Treasury spend-request draft.

It does not create, sign, broadcast or execute a Solana transaction.

## Payout eligibility

An application enters the payout proposal only when:

- status is PASS;
- score is greater than zero;
- Discord applications have a recorded Discord identity verification;
- Naver Cafe applications have a recorded Naver channel verification.

A PASS application that has not completed its required channel verification remains on payout HOLD.

## Batch draft input

The protected administrator API accepts:

- `budgetId`: separately approved Treasury budget identifier;
- `feeCapLamports`: fee ceiling per payout request;
- `startsAt`: exact UTC timestamp ending in `.000Z`;
- `expiresAt`: exact UTC timestamp ending in `.000Z`.

Endpoint:

`POST /api/airdrop/devnet-batch-draft`

The existing Airdrop administrator bearer token is required.

## Batch output

The result contains:

- deterministic `batchId`;
- Devnet network marker;
- Genesis campaign marker;
- payout count;
- total proposed SHAH;
- one Treasury spend-request draft per recipient;
- `requiresTreasuryApproval: true`;
- `transactionCreated: false`;
- `signed: false`;
- `broadcast: false`.

The batch draft does not prove that `budgetId` exists or is approved.

The Treasury store remains authoritative. When a draft is later submitted to Treasury, Treasury must independently verify:

- the budget exists;
- the budget has the required approvals;
- the budget is still valid;
- the spend is within the approved period;
- cumulative SHAH and fee reservations stay within budget limits;
- conflicts and signing thresholds remain valid.

## Security boundary

This feature does not:

- store private keys or seed phrases;
- create Solana transaction bytes;
- request wallet signatures;
- broadcast to Devnet or Mainnet;
- move Treasury funds;
- bypass Treasury approval thresholds.

## Operational sequence

1. Application submitted.
2. PASS / REVIEW / REJECT classification.
3. Required channel identity verified.
4. Payout proposal generated.
5. Operator supplies a separately approved Treasury budget ID.
6. Devnet batch draft generated.
7. Treasury independently validates and creates spend requests.
8. Treasury policy approvals occur.
9. Transaction preparation/signing remains a separate future gate.

Steps 7–9 are not automatically executed by the Airdrop batch-draft endpoint.
