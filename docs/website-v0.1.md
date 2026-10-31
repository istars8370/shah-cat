# SHAH CAT Website v0.1 (2026-10-31)

This feature adds a standalone public-facing informational homepage, while preserving existing Devnet wallet and local Treasury capabilities.

## Local access

Node.js 20+ required. From repo root:

    node dashboard/server.mjs

- Official site: http://127.0.0.1:4173/site/
- Devnet wallet dashboard: http://127.0.0.1:4173/
- Local-only Treasury: http://127.0.0.1:4173/treasury.html

The server binds to 127.0.0.1. This is not a public internet deployment.

## Safety and separation

- Official site is informational and read-only; it does not expose a real balance API or request wallet authorization.
- It labels SHAH as a Devnet test token with no monetary value; no Mainnet, public swap, or DEX release is claimed.
- Adopted whitepaper/tokenomics documentation is v0.6; dashboard vesting and Treasury logic still use v0.5.
- Treasury is NOT a production admin service. Never expose the local server behind a public proxy. Public deployment of administrative functionality requires authenticated roles, secure storage and a separate security review.
- No keys, wallet secrets, policy quantities or on-chain transactions are changed.

## QA

Run: node --test dashboard/*.test.mjs

Also verify mobile menu, typography, logo, links, focus navigation, live Devnet RPC on a suitable PC, and status labels. A static hosting preview can serve only the site/ files from domain root, after review. Do not deploy the dashboard or Treasury routes publicly.