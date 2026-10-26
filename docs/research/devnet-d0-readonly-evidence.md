# Devnet D0 Read-Only Evidence Gate

Status: READY FOR MANUAL WORKFLOW EXECUTION

D0 proves only that the configured RPC endpoint reports the expected Solana Devnet genesis and returns well-formed finalized-slot/version metadata.

It does **not** prove:
- Guardian deployment or recovery execution
- SHAH token transfers
- Falcon/PQC verification
- custody safety
- Treasury authorization
- mainnet readiness

## Evidence command

Local:

    node research/four-way/devnet-d0-evidence.mjs

GitHub Actions:
- workflow: Devnet D0 read-only evidence
- trigger: manual workflow_dispatch only

## Expected evidence
The JSON output must include:
- gate = D0
- network = devnet
- expected Devnet genesis hash
- nonnegative finalized slot
- bounded solana-core version
- readOnly = true
- transfersEnabled = false
- commit SHA when executed in GitHub Actions

## Failure policy
Any transport, HTTP, JSON-RPC, genesis, slot or version validation error is a D0 FAIL.

Do not retry automatically in the workflow and do not reinterpret a failed live probe as a pass.

## Safety boundary
This workflow contains no private key, signer, transaction, transfer, deployment or account mutation step.


## Recorded live evidence — 2026-10-27 KST

GitHub Actions run: 40383873297

Result: **PASS**

Observed:
- gate: D0
- commit: 3b6ed70100b0e5c5d68a42313a26768d95ae924f
- network: devnet
- genesisHash: EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG
- finalized slot: 515431291
- solana-core: 4.4.0-beta.1
- readOnly: true
- transfersEnabled: false

Associated checks:
- Devnet D0 read-only evidence: PASS
- Four-Way research unit tests: PASS
- SHAH CAT CI: PASS

Interpretation:
This closes D0 only. It proves a live read-only Devnet network inspection at the recorded commit. It does not prove transaction execution, Guardian deployment, Falcon/PQC verification, custody safety or release readiness.
