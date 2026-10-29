# SHAH CAT Airdrop System v0.1

Status: implementation complete for guarded staging and Treasury-request preparation in PR #91.

## Safety boundary

v0.1 does **not** sign, broadcast, transfer, custody or move SHAH.

It does not store a seed phrase/private key and does not bypass Treasury approval policy.

Implemented automation stops at **pending Treasury spend-request creation**.

## Implemented flow

1. public application submission;
2. deterministic input and Solana public-address validation;
3. Genesis time/application/budget caps;
4. PASS / REVIEW / REJECT classification;
5. append-only application ledger with SHA-256 hash chain;
6. duplicate wallet/community/evidence/channel-account controls;
7. Naver Cafe and Discord channel metadata and contribution scoring;
8. Discord signed interaction handling for `/airdrop`, `/verify`, `/status`;
9. manual REVIEW decisions with append-only audit events;
10. channel-verification payout gate;
11. bounded payout proposal;
12. deterministic Devnet batch draft;
13. idempotent conversion of an Airdrop batch into pending Treasury spend requests;
14. Treasury policy approval remains mandatory;
15. transaction creation, signing and broadcast remain disabled.

## Genesis defaults

| Control | v0.1 default |
| --- | ---: |
| Campaign length | 30 days |
| Total payout ceiling | 2,000,000 SHAH |
| Application hard cap | 2,000 |
| Daily new-application cap | 150 |
| Daily payout-proposal cap | 100,000 SHAH |
| General per-recipient cap | 2% of campaign budget |
| Automatic transfer | Disabled |

## Community channel rules

### Naver Cafe

Naver Cafe applications may include channel account identity and Cafe evidence URLs.

Payout eligibility requires recorded channel verification.

### Discord

Discord applications use the immutable numeric Discord user ID from the signed interaction payload.

The bot command core supports:

- `/airdrop`
- `/verify`
- `/status`

`/verify` records an identity match only. It does not grant Treasury approval or send SHAH.

## Public deployment boundary

The public Airdrop edge is fail-closed.

Only explicit application assets and public Airdrop endpoints should be proxied.

Administrator, Treasury, ledgers and secrets remain private/local.

Discord interactions are designed for a separate signed endpoint.

## Treasury handoff

The operator first generates a deterministic Devnet batch draft.

A separately approved Treasury budget ID is required.

The protected administrator bridge may then convert the batch into **pending Treasury spend requests**.

Batch creation is idempotent: replaying the same batch returns the existing requests instead of creating duplicates. Reusing the same batch ID with changed content is rejected.

Treasury remains authoritative for:

- budget existence and approval;
- validity period;
- cumulative token/fee limits;
- conflicts;
- approval threshold;
- signed policy decisions.

## Execution state

All Airdrop/Treasury outputs keep these properties:

- `transactionCreated: false`
- `signed: false`
- `broadcast: false`
- no automatic Treasury movement
- Devnet policy preparation only

## Operational tooling

Implemented:

- runtime readiness check;
- fail-closed reverse-proxy examples;
- bounded staging load probe;
- ledger backup;
- backup checksum/hash-chain verification;
- operator runbook;
- isolated staging rehearsal workflow.

## Remaining external work before public launch

1. configure a real staging/public host with TLS;
2. configure Discord Application ID, Guild ID, Public Key and Bot Token in runtime secrets;
3. register the guild slash commands;
4. set the Discord Interaction URL and verify signed PING/commands;
5. create and approve the actual Genesis Treasury budget;
6. run real-host staging load/persistence/backup tests;
7. perform final PR #91 review and merge;
8. re-run required CI on `main`.

Actual transaction construction/signing/broadcasting is a separate future authorization gate.
