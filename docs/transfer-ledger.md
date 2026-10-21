# SHAH CAT Devnet transfer ledger

This is a **test-token transfer history**, not a mainnet financial ledger or a live wallet balance.

## Files
- [Transfer records (CSV)](./devnet-transfer-log.csv)
- [Wallet roles and authority audit](./wallet-operations.md)

## How to add a transfer
1. Confirm that the network is **Devnet** and that the mint is `82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2`.
2. Transfer a small amount and save the public transaction signature.
3. Verify the transfer on Solana Explorer and/or with `spl-token -u devnet accounts --owner PUBLIC_ADDRESS`.
4. Add one new row to `devnet-transfer-log.csv`. Keep previous rows unchanged.
5. Set `status` to `confirmed` only after verification; otherwise use `pending_verification`.

### Column definitions
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
- The recorded **2,100 SHAH** is the sum of two test transfers, not an allocation of the full 1 billion SHAH supply.
- Sending tokens between owned wallets does not change total supply.
- A GitHub CSV is manually maintained, not automatically synchronized with the blockchain.
- Do not store private keys, recovery phrases, or API secrets in GitHub.
- No real financial value or token distribution policy is implied by Devnet testing.

## Read-only balance check
```bash
spl-token -u devnet accounts --owner 9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9
```
