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

## Security rules

- Never commit a seed/recovery phrase, private key, keypair JSON, wallet backup, API secret, or password.
- Wallet names are labels; separate addresses do not necessarily mean independent recovery phrases.
- The Treasury account was added in Phantom without a new recovery phrase being shown. It may share recovery credentials with another Phantom account; confirm account derivation and recovery arrangements privately before mainnet.
- The development wallet currently retains mint authority for Devnet testing; freeze authority was previously checked as absent. Recheck all authorities before mainnet.
- Keep test and production addresses clearly separate. Never send mainnet funds to a Devnet-only workflow.
- Use a separately secured wallet, ideally hardware-backed or multisig where appropriate, before holding meaningful mainnet assets.
- No actual market value, exchange listing, or mainnet deployment is implied by these Devnet tests.

## Next checklist

- [x] Register public development and Treasury wallet addresses
- [x] Verify 100 SHAH Treasury test receipt
- [ ] Confirm wallet backup and independence without disclosing secrets
- [ ] Recheck Mint Authority, Freeze Authority, and metadata update authority
- [ ] Define Devnet allocation and transfer log
- [ ] Complete mainnet security, legal, and operational readiness review
