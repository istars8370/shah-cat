# SHAH CAT Genesis Airdrop v0.1 operator runbook

This runbook is for staged deployment and operations. It does not authorize Mainnet, token signing, broadcasting, custody or Treasury movement.

## 1. Before startup

Set these runtime values outside the repository:

- `AIRDROP_STARTS_AT`: exact UTC ISO timestamp.
- `AIRDROP_PUBLIC_ORIGIN`: exact public browser origin.
- `AIRDROP_ADMIN_TOKEN`: random administrator secret of at least 24 characters.

Then run:

`node scripts/check-airdrop-readiness.mjs`

Expected result: `"ready": true`.

Do not continue if readiness reports an issue.

## 2. Start the local service

The Node service must continue to bind to `127.0.0.1`.

The Internet edge should proxy only the explicit paths in `deploy/airdrop-nginx.example.conf`.

Never expose the administrator dashboard, Treasury dashboard, administrator API, Treasury API, local ledger directory or environment variables.

## 3. Verify the public boundary

From the public origin verify:

1. `/apply.html` loads.
2. `/api/airdrop/public/health` returns only `ready` and `version`.
3. `/api/airdrop/public/status` returns aggregate campaign status.
4. an unapproved Origin is rejected.
5. `/airdrop.html`, `/treasury.html`, `/api/airdrop` admin routes and `/api/treasury` are not reachable through the public edge.

Any failure in item 5 is a launch blocker.

## 4. Staging load check

Run the bounded probe only against staging:

`AIRDROP_LOAD_CONFIRM=STAGING_ONLY AIRDROP_LOAD_TARGET=https://staging.example AIRDROP_LOAD_ORIGIN=https://staging.example node scripts/airdrop-load-staging.mjs`

The probe is capped at 150 requests and 10 workers.

Launch blocker conditions include:

- server 5xx errors;
- ledger corruption;
- process crash;
- capacity controls not activating;
- administrator/Treasury routes becoming public.

## 5. Backup

Back up the append-only application ledger before deployment changes and at an operationally appropriate cadence.

Example:

`AIRDROP_LEDGER_PATH=dashboard/.airdrop-data/events.jsonl AIRDROP_BACKUP_DIR=/secure/airdrop-backups node scripts/backup-airdrop-ledger.mjs`

The backup script writes:

- a timestamped JSONL copy;
- a SHA-256 checksum file.

Keep backups outside the public web root.

## 6. Verify a backup

Before relying on a backup:

`node scripts/verify-airdrop-backup.mjs <events-backup.jsonl> <events-backup.jsonl.sha256>`

The verifier checks:

- file checksum;
- newline completion;
- event sequence;
- previous-digest pointers;
- every event digest.

A failed verification means the backup must not be used.

## 7. Administrator review

Only REVIEW applications receive a manual approve/reject action.

The operator must enter a review note. The result is appended to the audit ledger.

Do not approve because a user holds more SHAH or claims expected token price performance.

## 8. Payout proposal

The payout proposal is not a transaction.

Treasury export keeps `budgetId` unset until a valid, separately approved Genesis campaign budget exists.

Do not manually insert a fake budget identifier simply to bypass Treasury checks.

## 9. Incident response

Immediately stop public intake or remove the public reverse-proxy route when any of these occur:

- unexpected 5xx burst;
- ledger integrity failure;
- administrator credential exposure;
- administrator or Treasury route becomes public;
- suspected automated abuse beyond review capacity;
- campaign cap inconsistency;
- security report indicating material risk.

Preserve the ledger and logs needed for review, rotate exposed administrator credentials, verify the latest backup, and do not resume until the root cause is understood.

## 10. Campaign shutdown

Stop new applications when the earliest configured hard condition occurs:

- 30-day period ends;
- 2,000 application hard cap is reached;
- 2,000,000 SHAH campaign allocation ceiling is reached.

Do not automatically extend the Genesis campaign. Any successor campaign requires a separate decision and budget.
