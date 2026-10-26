# SHAH Guardian G1 — State-Only Research Program

Status: **research only / no custody / no token movement**

## What G1 implements
- deterministic Guardian config PDA derived from owner + mint
- payer-funded PDA creation through the System Program
- owner signature requirement at initialization
- persisted owner and mint
- up to 5 unique Guardian public keys
- threshold validation
- guardian-set version
- recovery nonce field
- pending-owner field
- recovery timing fields
- freeze field
- fixed binary state layout with round-trip tests

## What G1 does not implement
- initiate recovery
- finalize recovery
- cancel recovery
- guardian rotation
- trusted Clock enforcement
- signed Guardian quorum verification
- SPL token custody
- Treasury access
- Falcon/PQC authorization
- Devnet deployment
- mainnet deployment

## Instruction format

Initialize only:

- byte 0: opcode = 0
- byte 1: threshold
- byte 2: guardian count
- remaining bytes: guardian public keys, 32 bytes each

Accounts:
1. payer — signer, writable
2. owner — signer
3. mint — read-only identity only
4. Guardian config PDA — writable, uninitialized
5. System Program

PDA seeds:
- "guardian-config"
- owner public key
- mint public key

## State safety notes
The persisted recovery fields are placeholders for later G2/G3 instructions. Their existence in G1 must not be interpreted as recovery being implemented.

## Local validation
From this directory:

    cargo test

Expected current unit coverage:
- state pack/unpack round trip
- guardian uniqueness
- threshold bounds
- instruction parser
- malformed instruction length
- fixed state size

A passing unit test run is not Devnet evidence and is not a production security claim.
