# Airdrop v0.1 PR #91 merge checklist

## Code / CI

- [x] SHAH CAT CI passes on current feature head
- [x] Stabilization verification passes
- [x] Offline Devnet and wallet security passes
- [x] Isolated Airdrop staging rehearsal passes
- [x] Public Airdrop ingress remains fail-closed
- [x] Administrator and Treasury routes remain private/local
- [x] Discord interaction requests require Ed25519 signatures
- [x] Discord identity verification does not auto-PASS or auto-pay
- [x] Naver/Discord payout eligibility requires channel verification
- [x] Devnet batch draft creates no transaction
- [x] Airdrop-to-Treasury batch bridge creates pending requests only
- [x] Batch replay is idempotent
- [x] Same batch ID with changed content is rejected

## External configuration still required

- [ ] Real staging host selected
- [ ] TLS configured
- [ ] AIRDROP_STARTS_AT configured
- [ ] AIRDROP_PUBLIC_ORIGIN configured
- [ ] AIRDROP_ADMIN_TOKEN configured
- [ ] TREASURY_CONFIG configured
- [ ] Genesis Treasury budget created and unanimously approved
- [ ] DISCORD_APPLICATION_ID configured
- [ ] DISCORD_GUILD_ID configured
- [ ] DISCORD_PUBLIC_KEY configured
- [ ] DISCORD_BOT_TOKEN configured
- [ ] Discord guild commands registered
- [ ] Discord Interaction URL verified against the real Discord application
- [ ] Real-host load/backup/restart rehearsal passed

## Merge rule

PR #91 may be merged after final review if the current feature-head CI remains green.

Merging does **not** authorize:

- Mainnet;
- real token transfer;
- transaction signing;
- transaction broadcast;
- Treasury custody changes;
- mint/freeze authority changes.

Those remain separate authorization gates.
