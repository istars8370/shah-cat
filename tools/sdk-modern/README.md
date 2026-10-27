# Modern Solana SDK parity candidate (B-011)

Status: **DRAFT / RESEARCH-ONLY / NOT INTEGRATED / NO-GO FOR MERGE**.

This directory is an isolated SDK migration candidate. It is **not** used by the Dashboard, has no signed transaction path, and must not be treated as a production dependency replacement or security remediation yet.

## Verified evidence and its scope (2026-10-27 KST)

- PR #75: [modern ATA and token byte-parity discovery](https://github.com/istars8370/shah-cat/pull/75); [Actions run 40435633996](https://github.com/istars8370/shah-cat/actions/runs/40435633996) **PASS**. The workflow installed the modern packages in a temporary runner directory and checked instruction data/accounts, frozen ATA owner vectors, and unsigned legacy message/wire bytes against existing fixtures. This supports **the isolated discovery run only**.
- PR #76: [candidate](https://github.com/istars8370/shah-cat/pull/76); [Actions run 40435850940](https://github.com/istars8370/shah-cat/actions/runs/40435850940) **PASS for existing Dashboard/SDK reference CI only**. That CI did **not** run tests from this `tools/sdk-modern` directory or validate its dependency tree.
- PR #70: [SDK dependency guard](https://github.com/istars8370/shah-cat/pull/70); [Actions run 40432237794](https://github.com/istars8370/shah-cat/actions/runs/40432237794) **FAIL** for locked legacy development SDK dependencies, including high-severity [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg) in transitive `bigint-buffer`. This is an unresolved **development/reference-tool dependency finding**; it is not evidence that Dashboard runtime exposure has been established.

## Known gaps in this candidate

1. `package.json` currently uses version ranges (`^`) rather than reviewed exact versions; there is no committed `package-lock.json`. The discovery install from PR #75 cannot substitute for this candidate's reproducible install.
2. No committed `*.test.mjs` in this directory exercises the modern package declarations. The `npm test` script is not proof of successful parity without tests and a CI job that actually invokes it.
3. There is no candidate-scoped audit output showing absence of `bigint-buffer` or any remaining high/critical advisories.
4. No owner has approved replacing the legacy fixture generator or SDK dependencies. This branch is stacked on the research chain and must not be merged out of order.

## Required acceptance gates, in order

1. Review and pin **exact** modern SDK package versions; commit a deterministic lockfile. Review the license and package provenance. Use `npm ci --ignore-scripts` in a clean runner (no `npm install` drift in the gate).
2. Add offline-only candidate tests against the repository's immutable reference fixture: **six** transfer/message/wire scenarios, **38** owner ATA vectors, instruction account roles/program IDs, and negative cases (wrong destination, program, or amount). Assert complete unsigned-message and serialized-wire byte equality for the supported legacy transaction profile.
3. Run the above tests in a dedicated, least-privilege CI job scoped to this directory and pin the Node/toolchain version; retain output that names exact versions and the repository commit.
4. Run a candidate-specific lockfile audit. Require `bigint-buffer` to be absent and high/critical dependency advisories to be resolved or explicitly blocked with a documented human risk decision; **do not silence the existing B-011 guard or use `npm audit fix --force`**.
5. Recheck and document compatibility with the current Dashboard/Wallet integration branch and existing legacy golden fixtures. Seek a human review of all gates before integrating any dependency changes. Keep production/Mainnet **NO-GO** until separate system-wide evidence and review exist.

## Fail-closed execution boundary

**No private keys, signing, airdrops, RPC submission, transfers, Treasury, Guardian custody, Falcon authorization, deployment, or Mainnet actions** are in scope. If any gate is missing or CI only tests the legacy path, keep this candidate in draft status. Do not automatically merge this branch or its stacked parents.
