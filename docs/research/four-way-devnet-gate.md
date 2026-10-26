# Four-Way Devnet inspection gate

This PR adds a read-only Solana Devnet JSON-RPC probe for genesis hash, slot and node version. It does not simulate or submit any Solana transaction, deploy a program, sign messages, or establish Falcon verification feasibility.

To run manually (Node 18+):
`node --input-type=module -e "import('./research/four-way/devnet-readonly.mjs').then(async m=>console.log(await m.inspectDevnet()))"`

Run local tests: `node --test research/four-way/*.test.mjs`

Live Devnet network availability and tests are not verified by the GitHub file commit. Never infer transaction success from a read-only RPC response.

## Local hardening — 2026-10-27

The probe now checks the full Devnet genesis before secondary reads and again before returning success. A Devnet URL alone is insufficient. Calls run in the bounded order `getGenesisHash`, `getSlot(finalized)`, `getVersion`, `getGenesisHash`. Every request has a 15-second timeout, rejects redirects and checks JSON-RPC version, request ID, errors and a present result. There are no automatic retries.

Slot measurements must be nonnegative safe integers. Software version must be a bounded printable identifier; an optional feature-set must be a u32 or null. Missing or malformed data is rejected rather than labeled a successful Devnet inspection. The returned commitment is explicitly `finalized`, referring only to the requested slot read; it does not certify a transaction or state snapshot.

RPC response types were checked against the official [genesis](https://solana.com/docs/rpc/http/getgenesishash), [slot](https://solana.com/docs/rpc/http/getslot) and [version](https://solana.com/docs/rpc/http/getversion) references.

This remains isolated research code. It does not establish Guardian authentication, Falcon verification, custody safety or production approval. Local test and live probe evidence are maintained separately; these changes have not been verified by remote CI.
