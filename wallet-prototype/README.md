# SHAH Wallet — Devnet read-only prototype

Standalone wallet UI inspired by Tidecoin's wallet product features, **not a port of Tidecoin's UTXO wallet**. SHAH CAT is an SPL token on Solana.

## Run locally
Open this directory in a terminal and run `python -m http.server 8080`, then browse to `http://localhost:8080`. Use a desktop browser with Phantom installed, set to Devnet. The prototype is one static `index.html` with no build step.

## Features
- Connect/disconnect Phantom
- Show public wallet address
- Read SOL and SHAH balances via public Solana Devnet JSON-RPC
- Handle account switching and refresh
- Display explicit no-transfer/no-custody warnings

## Boundaries
- No key creation, import, storage or seed phrase prompts.
- No signing or sending transactions. Send button is disabled.
- No quantum resistance: PQC A/B work is independent research.
- Do not deploy this as a production wallet without security review.
- Public RPC may be throttled or blocked by browser CORS; use an audited RPC integration for production.
- Confirm the SHAH mint in the project's official README before changing it.

## Benchmark source
- https://github.com/tidecoin/tidewallet (archived wallet product README; feature inspiration only)
- https://github.com/tidecoin/electrum (archived Tidecoin wallet fork; different chain architecture)

## Next
Integrate into the existing dashboard routing after reviewing its source; add address book, transaction history and signed transaction flow only after threat modeling and tests.
