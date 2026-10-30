# SHAH CAT Discord Bot v0.1 implementation

Status: code implemented in PR #91, deployment not performed.

## Implemented

- Discord slash-command definitions for `/airdrop`, `/verify`, `/status`
- Discord Ed25519 interaction request signature verification
- signed interaction HTTP handler
- append-only Discord identity verification event
- status lookup by authenticated Discord user ID
- minimal ephemeral responses
- command manifest generator
- automated signature and command-flow tests

## Runtime values

A deployed Discord interaction endpoint requires:

- `DISCORD_PUBLIC_KEY`: the Discord application public key, 64 hexadecimal characters
- `AIRDROP_STARTS_AT`
- the Airdrop ledger/runtime configuration already documented for v0.1

A bot token is **not required for receiving slash-command interactions** in this staged HTTP interaction design. A bot token may be needed later for actions such as assigning roles or sending proactive messages. It must never be committed.

## Identity rule

The handler does not trust a Discord ID typed by the user.

For `/verify` and `/status`, the Discord user ID is read from the authenticated interaction payload (`member.user.id` or `user.id`).

The supplied Airdrop application must already contain the same Discord user ID. A different account cannot claim that application through `/verify`.

## Verification semantics

`/verify` records only that the Discord identity matched the existing application.

It does **not**:

- automatically grant PASS;
- increase a payout by itself;
- approve a Treasury request;
- send SHAH;
- assign a governance right.

Final application state remains controlled by the Airdrop review system.

## Public exposure

The main Airdrop public edge does not expose Discord interactions automatically.

If a Discord application is staged, use a separately reviewed endpoint such as the fail-closed example in:

`deploy/discord-interactions-nginx.example.conf`

Only `POST /api/discord/interactions` should be exposed on that edge.

## Registration

`node integrations/discord/print-command-manifest.mjs`

prints the slash-command manifest suitable for review before registration.

The repository does not automatically register commands because registration requires Discord application credentials and is an external mutation.

## Still out of scope

- Discord role assignment
- Discord server/category/channel mutation
- proactive DMs
- self-bot automation
- wallet signing
- token transfers
- Treasury movement
- Mainnet deployment
