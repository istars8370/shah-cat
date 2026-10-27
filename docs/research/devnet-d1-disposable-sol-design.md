# Devnet D1 Disposable SOL Smoke Test Design

Status: DESIGN ONLY / NOT EXECUTED
Work package: D1-DESIGN-HARDEN-01 (P0-01)
Updated: 2026-10-27 KST

## Objective and current scope
Define a minimal disposable Devnet SOL transaction experiment and its offline acceptance tests.
This PR changes documentation only. No D1 runner, key generation, signing, faucet request,
transaction submission or workflow is implemented or executed by this package.

D1 does **not** validate SHAH token transfers, Guardian custody/recovery, Treasury
authorization, Falcon/PQC authorization, production wallets, release readiness or mainnet.

## Human authorization and trigger gate
A future implementation and a future live execution require separate, explicit human review.
Approval of this document, green CI, D0 evidence, a schedule, or a previous run is not execution authorization.
Before any live key generation or RPC/faucet activity, record the authorized human decision,
reviewed commit SHA, exact manual workflow/run, Devnet endpoint, numeric limits and expiry.
The two joint decision-makers must confirm their approval policy and authorized maintainer identities;
until that is settled, live execution stays HOLD.

Any future live runner must be manual workflow_dispatch only, with an approval gate checked
before any live step. No push, pull_request, schedule, workflow_run or automatic rerun may
invoke it. Every live attempt requires a new approval; this package adds no executable workflow.
A failed or ambiguous attempt cannot silently reuse an earlier approval.

## Safety boundary
- Use a newly generated disposable sender and a distinct newly generated disposable recipient.
- Keys are Devnet-only, in memory for this run only; never import/reuse a wallet or key file.
- Before faucet funding, finalized balances for both new addresses must be zero.
- Funding must be a confirmed same-run Devnet faucet receipt, never a pre-existing balance.
- Faucet failure, timeout, error receipt or unexpected funding is a hard failure even if a balance is positive.
- No SHAH mint/token accounts, Treasury, Guardian custody, production seed phrases or mainnet.
- Permit exactly one ordinary System Program SOL transfer, one sender signature and the sender as fee payer.
- No additional instructions, account creation, priority fees, durable nonce, alternate payer or program calls.
- Keep private material out of files, caches, logs, environment dumps, errors and artifacts.
  Disable verbose/debug traces and do not upload raw runner output or transaction objects.
- Dispose of key references on every exit path; no persisted recovery material. Memory disposal is
  best effort and is not proof of physical erasure. Any secret exposure is an incident and cannot PASS.

## Proposed fixed limits (not authorization)
These values are a review proposal. A future implementation must enforce integers in lamports
and reject missing, malformed, negative, fractional, unsafe-integer or above-cap values.
Any limit change requires human review before execution.

| Parameter | Fixed value / maximum |
|---|---|
| transferLamports | Exactly 1,000 lamports (0.000001 SOL); one transfer |
| faucetLamports | Exactly 1,000,000 lamports (0.001 SOL); one request |
| maxFeeLamports | 10,000 lamports; estimated and actual fee must each be at most this cap |
| maxSenderDebitLamports | 11,000 lamports, and exactly transferLamports + actual fee |
| maxRpcRequestMs | 10,000 ms per read/request, bounded by the total deadline |
| maxFaucetFinalizeMs | 60,000 ms including faucet request and finalized receipt checks |
| maxTransferFinalizeMs | 60,000 ms including submission, finalization and receipt verification |
| maxRunMs | 180,000 ms total wall-clock deadline; polling does not reset it |
| maxFaucetRequests / maxTransferSubmissions | 1 / 1 per authorized run |
| readPollIntervalMs | At least 2,000 ms; read-only polling only within the deadlines |

If faucet policy cannot supply the proposed amount, STOP; do not increase it or use other funds.
If the transfer would violate account/rent constraints or fail preflight, STOP; do not increase the amount.
No automatic retries of funding or submission, network fallback, replacement transaction or refreshed-blockhash resend.
Read-only status polling is allowed only for the already known signature, within the deadlines.

## Proposed future execution sequence
1. Validate unexpired approval, exact commit, manual trigger and limits before live activity.
2. Run D0 in this same run against the configured, pinned Devnet endpoint.
   Require genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
   Earlier D0 run 40383873297 is context only and cannot satisfy this gate.
3. Generate the fresh in-memory sender and recipient, verify distinct public keys and zero finalized balances.
4. Request the exact faucet amount once. Independently retrieve its finalized receipt by signature:
   require meta.err = null, expected sender credit and finalized balance 1,000,000 lamports.
   A positive balance without this receipt is never sufficient.
5. Recheck genesis immediately before signing/submission. Use the same pinned endpoint throughout;
   an independent receipt query means a separate read, not an automatic endpoint switch.
6. Build and decode the intended one-instruction System Program transfer. Require exact sender,
   recipient, fee payer, one required signature, amount, no extra instructions/accounts beyond the
   ordinary transfer message and no priority fee. Record blockhash and lastValidBlockHeight.
7. Quote the fee for that exact message. Require a finite, nonnegative integer quote at most
   10,000 lamports and enough faucet-funded balance for amount + fee.
   Freeze the reviewed message; if it changes or expires, STOP. Do not sign a replacement.
8. Sign only after all gates pass and submit exactly once with preflight enabled and RPC
   transport rebroadcast retries disabled (maxRetries = 0). Know the intended transaction signature
   before submission so a lost response can be investigated without sending again.
9. Wait for finalized status and independently retrieve the receipt for that exact signature.
   Both reads must fit the 60,000 ms transfer deadline and total 180,000 ms deadline.
10. Recheck genesis after receipt retrieval and apply every receipt invariant below.
11. Emit only allowlisted public evidence; discard keys on success, failure, cancellation and timeout.

## Receipt invariants
All checks are mandatory, with missing or malformed fields rejected:
- Same-run D0 and before/after genesis checks match the expected Devnet hash.
- Requested signature, returned signature and finalized status refer to the same intended transaction.
- Finalized status has no error; independently fetched transaction has meta.err exactly null.
- Receipt slot is a nonnegative integer and is covered by finalized status.
- Decoded message matches the frozen intended message: System Program, exactly one transfer,
  exact sender/recipient, sender fee payer, one required signature, exact 1,000 lamports,
  expected blockhash and no extra instructions.
- meta.fee is an integer from 0 through 10,000 lamports; quote alone is not proof of actual fee.
- Receipt pre/post balances are mapped by account keys, not assumed array positions.
  Sender debit equals 1,000 + actual fee and is at most 11,000; recipient credit equals 1,000.
- Sender prebalance is the confirmed faucet-only balance; recipient prebalance is zero.
  Unexplained balance changes fail. Additional finalized balance reads are supporting evidence,
  not a substitute for transaction-specific meta.preBalances/meta.postBalances.
- Null/unavailable receipt, wrong signature, wrong account, wrong amount, extra instruction,
  non-finalized status or inconsistent balance/fee is never PASS.

## Failure and ambiguous submission policy
- Missing approval or non-manual trigger: HOLD before keys/network, zero funding/submission calls.
- Wrong network at any check, reused/nonzero account, failed faucet, excessive fee, invalid message
  or expired blockhash before submission: FAIL and STOP, zero transfer submissions.
- Explicit transaction/preflight error or non-null receipt meta.err: FAIL, no retry.
- Submission timeout/connection loss, inconsistent response signature, missing receipt, finalization
  timeout or blockhash expiry after submission: INDETERMINATE / HOLD, never PASS.
  Preserve only the known public signature and failure stage for separately reviewed read-only reconciliation.
  Do not sign, resubmit, refresh a blockhash, fund again or start another transfer.
- Network mismatch after submission: FAIL with execution outcome unresolved; HOLD for human review.
- Read-only reconciliation can establish the original outcome later, but cannot authorize a new send.
- On every failure, cleanup still runs; a failed cleanup or secret leak prevents PASS.
- Do not reinterpret a timeout, skipped check, exception or positive balance as successful evidence.

## Public evidence allowlist
Emit a new object containing only these reviewed fields; never serialize whole RPC responses,
exceptions, environment variables, signed transactions, request headers or keypair objects:
- gate = D1; status = PASS / FAIL / INDETERMINATE / HOLD
- repository commit SHA, manual run ID/link and public approval reference (no approval credentials)
- network = devnet; readOnly = false; transfersEnabled = true (future live run only)
- expected, same-run D0, pre-submit and post-receipt genesis hashes
- sender/recipient public keys; faucet and transfer public signatures when known
- transferLamports, quotedFeeLamports, actualFeeLamports, sender debit and recipient credit
- finalized slot/status and normalized receipt error result
- transaction-specific public pre/post balances
- timestamps, elapsed time, configured limits, attempted funding/submission counts
- receipt verification result, cleanup result and bounded failure-stage/reason code

Offline reports must say mode = offline-mock, liveExecuted = false and D1 = NOT EXECUTED.
Use synthetic public labels/signatures; no key generation or valid signed transaction is needed.
Only allowlisted evidence may be published after review. Never include secret bytes, seed phrases,
private-key files, secret environment variables, tokens, raw stack traces or sensitive endpoint URLs.

## Offline mocked test design (NOT RUN)
This section is a specification for a future test package, not implemented tests or live evidence.
Use dependency-injected fake RPC, faucet, signer and clock adapters, synthetic identities,
a fake finalized receipt and deterministic time. Do not import a live connection, key generator
or transaction broadcaster. Deny all real network and filesystem writes; any attempt fails the test.
The fake signer records calls without cryptography. The fake submitter only records messages.

For each scenario assert result + reason, exact faucet/sign/submit call counts, cleanup, bounded
elapsed time, no forbidden adapter calls and evidence allowlist. A passing mock never marks D1 PASS.
Start with a valid synthetic baseline, then mutate one invariant at a time; use distinct expected
and actual fixture fields so a tautological comparison cannot pass.

| ID | Injected condition | Expected result / key assertion |
|---|---|---|
| M01 | Valid approved/manual synthetic path | Mock acceptance only; faucet/sign/submit = 1/1/1; exact receipt checks; D1 NOT EXECUTED |
| M02 | Missing/expired approval, wrong SHA or automatic trigger | HOLD; faucet/sign/submit = 0/0/0 |
| M03 | Wrong D0 genesis or identity check timeout/malformed result | FAIL; no keys/funding/sign/submit |
| M04 | Reused/nonzero sender or recipient, or identical identities | FAIL; faucet/sign/submit = 0/0/0 |
| M05 | Faucet rejects, times out or receipt meta.err is non-null | FAIL; faucet = 1, sign/submit = 0/0 even when fake balance is positive |
| M06 | Faucet receipt missing/wrong credit or unexpected balance | FAIL; no sign/submit; no balance fallback |
| M07 | Genesis changes before submission | FAIL; sign/submit = 0/0 |
| M08 | Wrong sender/recipient/fee payer, amount or extra instruction before signing | FAIL; sign/submit = 0/0; test each mutation separately |
| M09 | Fee quote null, malformed, negative or 10,001; insufficient funds | FAIL; sign/submit = 0/0 |
| M10 | Fee quote exactly 10,000; actual fee 0 or exactly 10,000 | Mock accepts boundaries only when all debit/credit invariants match |
| M11 | Expired blockhash or message changes before signing | FAIL; sign/submit = 0/0; no refreshed message |
| M12 | Explicit preflight/submission error | FAIL; one sign/submit at most; no resend |
| M13 | Submission accepted but response lost or signature differs | INDETERMINATE / HOLD; exactly one submit; no new signing/submission/funding |
| M14 | Confirmation never finalizes, receipt null or expiry after submit | INDETERMINATE / HOLD; bounded polling; no retry |
| M15 | Finalized receipt has wrong signature/sender/recipient/amount/payer/program or extra instruction | FAIL; mutate each separately; one submit, no retry |
| M16 | Receipt meta.err non-null/missing, fee missing/malformed/negative/10,001 | FAIL; quote within cap cannot override actual receipt failure |
| M17 | Sender debit/recipient credit/prebalance inconsistent or reordered account keys | FAIL for inconsistent values; correct reordered mapping accepts mock baseline |
| M18 | Genesis changes after receipt retrieval | FAIL / execution unresolved HOLD; no further submission |
| M19 | RPC lasts over 10,000 ms, faucet/transfer over 60,000 ms, run over 180,000 ms | Abort at earliest deadline; FAIL before submit, INDETERMINATE after submit |
| M20 | Invalid limits: missing, NaN, fractional, negative, unsafe integer or over cap | FAIL before live adapters; no silent coercion |
| M21 | Secret sentinel in adapter response/error/extra property | Allowlisted report excludes sentinel and raw payload; exposure prevents acceptance |
| M22 | Exception/cancellation at every stage or cleanup failure | Cleanup invoked on every exit; failure cannot PASS |
| M23 | Retry attempt, alternate network or blockhash refresh requested | Forbidden adapter call rejected; transfer submit count never exceeds 1 |
| M24 | Receipt merely confirmed, malformed slot or missing finalized status | No acceptance; unresolved finality stays INDETERMINATE / HOLD |

Future acceptance of the offline package requires all scenarios implemented and actually run,
including individual field mutations and boundary values. Record exact command, commit and counts.
Until then the matrix is NOT RUN; existing Dashboard/SDK CI does not cover it.

## Acceptance and review checklist
Documentation package is ready for human review when:
1. Separate live approval and manual-only trigger are explicit.
2. Faucet-only ephemeral identities have no existing-balance fallback.
3. Numeric limits, exactly-one-submit and ambiguous-outcome rules are explicit.
4. Same-run D0, before/after genesis, finalized receipt, message, fee and balances are mandatory.
5. Public evidence and cleanup rules exclude secrets on every exit.
6. Offline matrix covers positive boundaries and each negative class without live adapters.

A future live D1 may PASS only after separate authorization, implemented/reviewed gates, all
required offline tests, successful same-run D0, exact finalized transfer receipt, matching caps,
safe evidence and cleanup. This document and ordinary CI cannot satisfy those live criteria.

## Remaining risks and next step
- No D1 implementation or mock suite exists in this PR; runtime enforcement is unproven.
- A pinned RPC reporting the right genesis is not independent proof of RPC honesty.
- Faucet availability, rent/account viability and confirmation timing require later approved validation.
- Both collaborators' approval policy and live-run safety review remain unresolved.
- Next: human review of this revised design; then separately scope an offline-only test package.
  Live execution, integration merge, production custody, Treasury, Falcon authorization and
  Mainnet remain HOLD / NO-GO.
