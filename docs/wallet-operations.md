# SHAH CAT — Wallet Operations (Devnet)

Last reviewed: 2026-10-21
Status: Devnet testing only; no mainnet launch.

## Network and token
- Chain: Solana
- Cluster: Devnet
- Token: SHAH CAT (SHAH)
- Mint: `82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2`
- Decimals: 9
- Test supply: 1,000,000,000 SHAH

## Public wallet registry

| Role | Public address | Purpose |
| --- | --- | --- |
| Development wallet (Solana Playground) | `3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs` | Devnet development, mint authority testing, test transfers |
| Treasury wallet (Phantom; SHAH Treasury) | `9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9` | Devnet operations and custody testing |

A third-party wallet received a 2,000 SHAH transfer in a separate test. Do not publish another person's address here without their permission.

## Confirmed Devnet tests

1. 1,000,000,000 SHAH test tokens issued.
2. Token metadata registered.
3. 2,000 SHAH sent to a separate recipient wallet in an earlier test.
4. 100 SHAH sent from the development token account to the Treasury wallet.
5. The Treasury wallet's token balance was independently queried with the SPL Token CLI and returned **100 SHAH**; Phantom also displayed **100 SHAH**.

Treasury recipient token account was created during the transfer, with a reported funding cost of 0.00148844 Devnet SOL.

### Read-only verification

```bash
spl-token -u devnet supply 82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2
spl-token -u devnet accounts --owner 9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9
```

## Authority audit (2026-10-21, Solana Devnet)

Read-only review of Solana Explorer screenshots of the SHAH CAT mint and Metaplex metadata:

| Setting | Observed value | Meaning |
| --- | --- | --- |
| Mint authority | `3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs` | Development wallet can authorize additional minting |
| Freeze authority | None | No SPL Token freeze authority is configured |
| Metadata update authority | `3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs` | Development wallet controls on-chain metadata updates |
| Metadata isMutable | `true` | Metadata remains mutable |
| Current supply | 1,000,000,000 SHAH | Observed on Devnet |
| Decimals | 9 | SPL token precision |

Mint account is a standard 82-byte SPL Token mint; the raw mint data screenshot was reviewed for freeze-authority state. The Explorer UI also displayed “Not verified”; that label is distinct from successful token minting and transfers.

Source: [SHAH CAT Devnet mint on Solana Explorer](https://explorer.solana.com/address/82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2?cluster=devnet)

**No authority was changed or revoked during this audit.** Recheck the live chain state before any production decisions.

## Proposed Devnet allocation workflow (not tokenomics)

- **Development:** Retain the existing development wallet as the current test-token source; no new minting is needed for this stage.
- **Treasury:** Use the Phantom Treasury account for limited test transfers and balance reconciliation. Current verified test balance: 100 SHAH (snapshot, not a live balance).
- **Recipients:** Only send test tokens to explicitly confirmed public addresses; obtain permission before publishing recipient addresses.
- **Recordkeeping:** For each transfer, log date, Devnet cluster, sender role, recipient role, amount, transaction signature, purpose, and verification status. Avoid recording private keys or recovery phrases.
- **Reconciliation:** Compare transaction history and `spl-token -u devnet accounts --owner <PUBLIC_ADDRESS>` results. Note that test tokens have no financial value.
- **Future mainnet:** Token distribution, reserves, authority governance, and regulatory review are separate decisions; none is approved by this Devnet plan.

## Security rules

- Never commit a seed/recovery phrase, private key, keypair JSON, wallet backup, API secret, or password.
- Wallet names are labels; separate addresses do not necessarily mean independent recovery phrases.
- The Treasury account was added in Phantom without a new recovery phrase being shown. It may share recovery credentials with another Phantom account; confirm account derivation and recovery arrangements privately before mainnet.
- The development wallet currently retains mint authority for Devnet testing; freeze authority was checked as absent on 2026-10-21. Recheck all authorities before mainnet.
- Keep test and production addresses clearly separate. Never send mainnet funds to a Devnet-only workflow.
- Use a separately secured wallet, ideally hardware-backed or multisig where appropriate, before holding meaningful mainnet assets.
- No actual market value, exchange listing, or mainnet deployment is implied by these Devnet tests.

## Next checklist

- [x] Register public development and Treasury wallet addresses
- [x] Verify 100 SHAH Treasury test receipt
- [ ] Confirm wallet backup and independence without disclosing secrets
- [x] Recheck Mint Authority, Freeze Authority, and metadata update authority (Devnet screenshot audit, 2026-10-21)
- [x] Document proposed Devnet allocation and transfer-log fields
- [ ] Begin maintaining an actual Devnet transfer log
- [ ] Complete mainnet security, legal, and operational readiness review
