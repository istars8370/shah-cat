# SHAH CAT Discord Bot v0.1 contract

Status: design contract for staged implementation. No bot token is stored or requested by this repository document.

## Purpose

The Discord bot is a community verification and status assistant. It is not a wallet custodian and cannot send SHAH.

## Commands

### /airdrop

Shows:
- Genesis campaign state;
- 30-day / 2,000-user / 2,000,000 SHAH limits;
- application page link;
- reminder that price, listing and investment return are not guaranteed.

It must never ask for a seed phrase or private key.

### /verify

Links a Discord user ID to an Airdrop application record for operator review.

v0.1 requirements:
- use the Discord user snowflake ID supplied by Discord, not a mutable nickname;
- never accept an arbitrary user-provided ID as verified identity;
- record only the minimum verification result needed by the Airdrop system;
- do not automatically mark a user PASS solely because they joined Discord.

Suggested verified activity mapping:
- Discord join: 1 point
- Discord verified: 2 points
- helpful Discord reply: 2 points
- verified test participation: 5 points

### /status

Returns only the requesting user's application status:
- PASS
- REVIEW
- REJECT

It must not expose another user's wallet, evidence URL, review note, or payout proposal.

## Roles

Suggested community roles:

- SHAH VERIFIED: identity/link verification completed.
- SHAH TESTER: verified testing contribution.
- SHAH CONTRIBUTOR: repeated useful contribution.
- SHAH GUARDIAN: manually awarded core/special contributor role.

Roles represent community contribution only. They do not create investment, dividend, Treasury, governance or payout rights.

## Bot security boundary

- Bot token stays in runtime secrets only.
- No user-account self-bot automation.
- Minimum Discord permissions.
- No Administrator permission unless separately justified.
- No token-transfer or wallet-signing capability.
- Rate-limit commands.
- Log command result metadata without logging secrets.
- Security reports should route to a private moderator channel.

## Integration contract

The bot may submit or verify these fields:

- channel = discord
- channelUserId = Discord snowflake ID
- evidence URL when available
- verified activity code
- verification timestamp
- bot/application version

The Airdrop engine remains the source of truth for PASS / REVIEW / REJECT and payout proposal generation.

## Not implemented by this contract

- Discord server mutations
- bot deployment
- production OAuth
- Linked Roles
- automatic SHAH payment
- Treasury approvals
- Mainnet activity

Those require separate implementation and deployment approval.
