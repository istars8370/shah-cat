# Four-Way Devnet inspection gate

This PR adds a read-only Solana Devnet JSON-RPC probe for genesis hash, slot and node version. It does not simulate or submit any Solana transaction, deploy a program, sign messages, or establish Falcon verification feasibility.

To run manually (Node 18+):
`node --input-type=module -e "import('./research/four-way/devnet-readonly.mjs').then(async m=>console.log(await m.inspectDevnet()))"`

Run local tests: `node --test research/four-way/*.test.mjs`

Live Devnet network availability and tests are not verified by the GitHub file commit. Never infer transaction success from a read-only RPC response.
