# SHAH CAT Devnet transfer ledger

This is a **test-token transfer history**, not a mainnet financial ledger or a live wallet balance.

## Files
- [Manual transfer records (CSV)](./devnet-transfer-log.csv)
- [Automatic on-chain ledger (CSV)](./devnet-transfer-ledger-auto.csv)
- [Automatic on-chain ledger (Markdown)](./devnet-transfer-ledger-auto.md)
- [Wallet roles and authority audit](./wallet-operations.md)

## Automatic ledger

`scripts/sync-devnet-ledger.mjs` reads public Solana Devnet RPC data for the Development wallet and representative SHAH whale wallets. The Founder wallet currently doubles as the Treasury wallet, the Operations Whale wallet is explicitly monitored, and the Investor Whale wallet can be supplied through the `PARK_WALLET` environment variable until its public address is formally recorded. It discovers recent signatures, fetches confirmed transactions, filters SHAH CAT mint balance changes, derives sender/recipient owner changes, classifies whale/Treasury/external flows, and regenerates the automatic CSV and Markdown files.

The GitHub Action `SHAH CAT Devnet Ledger Sync` can be started manually and is also scheduled once per day. It commits regenerated ledger files only when their contents change.

Security boundaries:
- Read-only public RPC calls only.
- No private keys, recovery phrases, wallet approvals, signing, or transaction broadcasting.
- Refuses to run if the RPC genesis hash is not Solana Devnet.
- Automatic output is evidence from a recent scan window, not a complete accounting or tax ledger.

## How to add a manual transfer note
1. Confirm that the network is **Devnet** and that the mint is `82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2`.
2. Transfer a small amount and save the public transaction signature.
3. Verify the transfer on Solana Explorer and/or with `spl-token -u devnet accounts --owner PUBLIC_ADDRESS`.
4. Add one new row to `devnet-transfer-log.csv`. Keep previous rows unchanged.
5. Set `status` to `confirmed` only after verification; otherwise use `pending_verification`.

### Manual CSV column definitions
- `date_utc`: calendar date in UTC (use a date only when an exact time is not recorded)
- `network`: devnet, not mainnet
- `token_symbol`: SHAH
- `mint`: SHAH CAT mint address
- `sender_role` / `recipient_role`: roles rather than personal names
- `recipient_public_address`: optional; leave blank for third-party privacy
- `amount`: human-readable SHAH units
- `transaction_signature`: public Solana signature; blank if not reliably transcribed
- `status`: confirmed or pending_verification
- `verification_note`: evidence and any limitations

## Important distinctions
- The manual CSV and automatic ledger serve different purposes. Do not overwrite the manual notes with generated data.
- Sending tokens between owned wallets does not change total supply.
- The automatic ledger scans recent transactions involving watched wallets; it is not a complete holder distribution.
- Do not store private keys, recovery phrases, or API secrets in GitHub.
- No real financial value or token distribution policy is implied by Devnet testing.

## Local read-only commands

Balance check:

```bash
node scripts/check-devnet-balances.mjs
```

Regenerate automatic ledger:

```bash
node scripts/sync-devnet-ledger.mjs
```
