# Four-Way read-only RPC hardening

Research only. Production remains **NO-GO**. This change does not add wallet access, signing, transactions, Guardian enforcement, Falcon verification or custody.

## Receipt verification

`verifyDevnetReceipt` validates a base58 transaction identifier encoding exactly 64 bytes, the fixed public Devnet URL, and the full Devnet genesis before and after a successful inspection. JSON-RPC envelopes must use version 2.0, match the request ID, contain a result and report no RPC error. Requests have a 15-second timeout and reject redirects; there are no automatic retries.

A successful result requires a finalized, explicitly successful status and transaction metadata, safe slots, agreement between the status and transaction slot, and the requested identifier as the transaction's first signature. Fees and any reported compute units must be nonnegative safe integers. Missing compute units return null. Missing or inconsistent metadata cannot be treated as a successful receipt.

This checks RPC-reported consistency, not independent cryptographic transaction inclusion, expected transfer contents, Guardian approval or program security. An old ordinary Devnet receipt does not satisfy a Four-Way program execution gate.

## Network inspection

`inspectDevnet` calls `getGenesisHash`, then `getSlot` at finalized commitment, `getVersion`, and a final `getGenesisHash`. Wrong genesis blocks secondary reads. Slots must be nonnegative safe integers; software version must be a bounded printable identifier, and an optional feature-set must be a u32 or null. A network metadata result is not a transaction receipt or deployment authorization.

The response shapes were checked against official Solana [genesis](https://solana.com/docs/rpc/http/getgenesishash), [slot](https://solana.com/docs/rpc/http/getslot), [version](https://solana.com/docs/rpc/http/getversion), [signature status](https://solana.com/docs/rpc/http/getsignaturestatuses) and [transaction](https://solana.com/docs/rpc/http/gettransaction) references.

## Validation and rollout boundary

The local Windows / Node.js v24.22.1 research suite passes 151 tests, including 26 receipt tests and 14 network probe tests. These counts overlap; do not add the component counts to the total. The six original receipt tests and three probe tests now use valid correlated RPC fixtures. New tests reproduce previously accepted invalid metadata and cover network changes, request IDs, malformed measurements and transport failures.

```sh
node --test research/four-way/*.test.mjs
node --test dashboard/*.test.mjs
```

Research and product tests use mocked RPC responses, temporary test keys and localhost HTTP servers. They do not execute an on-chain transaction. Product server, Treasury, tokenomics, scripts and product CI are unchanged. This PR must pass its own Node 22 remote CI before merging into the research integration branch; local success is not a substitute.

Authenticated on-chain guardians, persistent nonces, trusted clocks, audited vault authorization, actual protocol execution evidence, Falcon compatibility/runtime validation and an independent audit remain separate blockers. Keep `productionReady()` false and research code disconnected from product authorization paths.
