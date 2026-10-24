# SHAH CAT Devnet automatic ledger

Generated from Solana Devnet RPC. This file is read-only evidence derived from public on-chain data.

- Checked at: **2026-10-24T12:05:56.229Z**
- Mint: `82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2`
- Watched wallets: **4**
- Signature scan limit per watched wallet: **30**
- Matching transfer rows: **7**

| Time (UTC) | Class | Sender role | Recipient role | SHAH | Transaction |
| --- | --- | --- | --- | ---: | --- |
| 2026-10-14T11:45:00.000Z | development_or_other | Development | Operations Whale | 100 | `5eMLMGhErrWq9M7qSHrq1DsgDppwa3R7x2t8giBV7cRwp2homvfF3S4hu2exv4hCXEzQEwFhdohoWmJwVR23DaSL` |
| 2026-10-20T13:24:04.000Z | development_or_other | Development | Investor Whale | 2000 | `3j6v3h2v5FNEtVJVMR5mrLxoF3J8pNXHVgTbcoSMJzbnN63wXdksDTgmAtkgrEefh3B2saBNoLA1JKo3pEQT5U9H` |
| 2026-10-21T11:19:04.000Z | development_or_other | Development | Founder / Treasury | 100 | `2irYv7pkXUVi7UZS49BPbNeJyr78PidyLkFMrykTzM47rnD49rT7XmZMYdBZJLc9tQAU21vFPWjMG67pZPiXWr3o` |
| 2026-10-21T13:59:27.000Z | development_or_other | Development | Founder / Treasury | 100000 | `rFAFQg6vqfmzcDDYFXVNaVtuBQZd7FPzNTeSNCttpY7c34K6KvDUKyh9FSgTsJy88LnMi37Wqg8qprpUMZCdGr9` |
| 2026-10-24T03:32:16.000Z | development_or_other | Development | Founder / Treasury | 166566567 | `2v4Xtnuxv7HZ98C2vt4CpWc56Nd3tY6DbUAKziJMHui7KJrheou4r1PAUqdRx77RgyWhrjeWuDE2jaPT2xMKyyVw` |
| 2026-10-24T03:32:50.000Z | development_or_other | Development | Investor Whale | 166664666 | `513iKHAaA4WAZune8q4BjSVwPB7VZN7WRVCrSTNbcHdERVKnb1KJk1uWaAHC5379Bq8UFpxiVU668kHDPa1oMhKF` |
| 2026-10-24T03:36:36.000Z | development_or_other | Development | Operations Whale | 166666567 | `2ebZBf6aTRJVfJJHzDKr98UMv13FmV9zwngSQnoCG5rnyyr7e2xAum5YPNkDrypATRyzMQUQwNHvtV6bpGXw2BK7` |

## Scope and limitations

This ledger scans recent signatures for the configured Development wallet and representative SHAH whale wallets. The Founder wallet currently also serves as the SHAH Treasury public wallet. An Investor Whale address can be added through the PARK_WALLET environment variable until its public address is formally recorded. It is not a complete holder ledger, accounting system, tax record, or mainnet record. Complex multi-party token transactions can produce more than one derived row. Always verify material entries against Solana Explorer before relying on them.

The script never requests private keys, signs transactions, or broadcasts transactions.
