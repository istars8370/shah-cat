# SHAH CAT Airdrop v0.1 deployment boundary

This document describes the staged public deployment boundary for the Genesis Airdrop.

## Core rule

The SHAH CAT Dashboard and its administrator/Treasury endpoints remain bound to localhost.

Only these public resources should be proxied through the Internet edge:

- `/apply.html`
- `/apply-ui.js`
- `/dashboard.css`
- `/logo.png`
- `/api/airdrop/public/status`
- `/api/airdrop/public/applications`

Do not publish:

- `/airdrop.html`
- `/treasury.html`
- `/api/airdrop` administrator routes
- `/api/treasury`
- any local ledger files
- any environment variables or secrets

The example fail-closed reverse-proxy configuration is in `deploy/airdrop-nginx.example.conf`.

## Required runtime configuration

### AIRDROP_STARTS_AT

UTC ISO timestamp for the Genesis campaign start.

Example shape:

`2026-11-01T00:00:00.000Z`

The 30-day campaign window is derived from this value.

### AIRDROP_ADMIN_TOKEN

Administrator secret used only by local admin actions.

Requirements:

- minimum 24 characters;
- supplied at runtime only;
- never committed;
- never placed in a public page or public JavaScript;
- rotate if exposure is suspected.

### AIRDROP_PUBLIC_ORIGIN

Exact public browser origin accepted by the public ingress API.

Example shape:

`https://airdrop.example.com`

The public API rejects other browser origins. This is an origin boundary, not an identity system.

## Public ingress properties

The public API:

- exposes aggregate campaign status only;
- never returns the full application ledger;
- accepts application submission only;
- cannot review applications;
- cannot create Treasury approvals;
- cannot export Treasury proposals;
- cannot sign or broadcast transactions.

Administrator review, payout proposal and Treasury export stay on the local administrator interface.

## Rate and capacity controls

Application policy limits remain:

- 30 days maximum;
- 2,000 total applications;
- 150 accepted/review intake per UTC day;
- 2,000,000 SHAH campaign ceiling;
- 100,000 SHAH daily payout-proposal ceiling.

The reverse-proxy example also applies a per-source request-rate limit. This is an abuse-control measure only and must not be treated as proof that one IP equals one person.

## Sybil controls

v0.1 automatically rejects persisted duplicates of:

- public wallet;
- community ID;
- evidence URL.

It routes suspicious cases to REVIEW when:

- applications arrive unusually quickly;
- many recent applications use the same evidence domain;
- explicit high-risk review flags exist.

Do not add invasive device fingerprinting or collect unnecessary personal data without a privacy review.

## Staging load probe

`scripts/airdrop-load-staging.mjs` is intentionally bounded.

It requires:

- `AIRDROP_LOAD_CONFIRM=STAGING_ONLY`
- `AIRDROP_LOAD_TARGET`
- `AIRDROP_LOAD_ORIGIN`

Optional:

- `AIRDROP_LOAD_COUNT` (maximum 150)
- `AIRDROP_LOAD_CONCURRENCY` (maximum 10)

Do not run the probe against production or a third-party service without explicit authorization.

The probe reports created PASS results, REVIEW/REJECT results, errors, p50, p95 and maximum request time.

## Production readiness gate

Public launch remains NO-GO until all of the following are verified on the selected hosting environment:

1. TLS and reverse-proxy configuration reviewed;
2. only the explicit public paths are externally reachable;
3. administrator and Treasury paths are externally unreachable;
4. public Origin is configured correctly;
5. staging load probe completes without server errors;
6. ledger persistence survives restart and backup/restore practice;
7. operator review procedure is documented;
8. an approved Genesis Treasury budget exists before any payout request is created;
9. no private key or seed phrase is stored by the application;
10. signing/broadcasting remains separately authorized and reviewed.
