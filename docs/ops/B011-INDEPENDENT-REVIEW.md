# B-011 SDK remediation — independent review packet

Status: **PR #80 DRAFT / CI PASS / HUMAN REVIEW NOT RECEIVED / NOT MERGED**.
Repository: https://github.com/istars8370/shah-cat/pull/80

## Evidence snapshot (2026-10-27 KST)
- Head `0e92c11dd8a346e03f52e4a87936c1c749bc277b`; zero commits behind main when checked; 11 net changed files.
- [SHAH CAT CI 40439473425](https://github.com/istars8370/shah-cat/actions/runs/40439473425): PASS.
- [SDK dependency guard 40439473386](https://github.com/istars8370/shah-cat/actions/runs/40439473386): PASS.
- Review API returned **zero submitted human reviews** at evidence collection time.
- The modern verifier uses pinned `@solana/kit@6.10.0`, `@solana-program/token@0.10.0`; checked frozen 38 ATA owners, six unsigned legacy message/wire cases, instruction data/roles, and changed amount/destination/program negative controls.
- Four legacy package manifests/lockfiles removed; historical generator source and frozen fixture retained. Superseded research workflows are excluded from net diff.

## Independent review checklist

- [ ] Confirm the SHA and main merge base are still current. Verify only the expected 11 files in Files changed.
- [ ] Inspect frozen reference fixture provenance and commit history; confirm fixture data was **not** updated in this PR.
- [ ] Inspect the semantics of signer vs account roles and the fee payer/invoked program negative control.
- [ ] Confirm npm lock integrity and package provenance/license suitability; run clean `npm ci --ignore-scripts`, `npm test`, and full `npm audit --audit-level=high` in `tools/sdk-modern`.
- [ ] Search all workflows, scripts, docs and runtime imports for live consumers of retired `sdk-crosscheck` and `tools/sdk-reference` npm manifests.
- [ ] Confirm the Dashboard runtime remains unmodified; no Wallet/Guardian/Treasury/solana signing or broadcasting path changed.
- [ ] Check the guard runs on main, relevant PRs, on schedule, and rejects reintroduced legacy manifests and `bigint-buffer`.
- [ ] Review negative controls and add independent reviewer comments or CHANGES REQUESTED if acceptance fails.
- [ ] After explicit human approval, prefer squash merging PR #80 only. Re-run required CI on main, verify fresh audit and absence of legacy manifest files, and then assess whether issue #69 can be closed.

## Unresolved risks
The frozen fixture covers selected legacy SPL Token paths only: not Token-2022, arbitrary multi-instruction transactions, multisig, PDA ownership edge cases, hardware wallets, or actual live chain signing. Dependent feature branches may require rebase/retest. CI green is not an independent security audit or Mainnet release approval.

**Decision now: NO-GO for unattended merge / mainnet / signing / custody changes.** This packet records evidence, not a human approval.
