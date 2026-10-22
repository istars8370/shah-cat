# SHAH CAT PQC Research (Devnet only)

Status: Research / Not production security.

## Objectives
- A: Evaluate post-quantum signature generation and verification for signed project announcements and software update manifests.
- B: Investigate a Solana program-controlled SHAH vault requiring an additional post-quantum authorization, **only if** on-chain verification is feasible.

## Ground rules
- Keep existing SPL mint, dashboard, Phantom connection and `main` unchanged.
- No real funds, private keys, seed phrases or signing authority in this repository.
- Do not claim SHAH CAT is quantum-resistant merely because an off-chain signature verifier exists.
- Do not deploy a vault or advertise asset protection before tests, threat modeling and independent security review.
- Inspect upstream licenses, dependency versions, test vectors and source provenance before copying code.

## Upstream candidates (to audit, not blindly import)
- https://github.com/tidecoin/tide-fn-dsa
- https://github.com/tidecoin/tdc_falcon
- NIST FIPS 204 (ML-DSA): https://csrc.nist.gov/pubs/fips/204/final

## Milestone A1: Off-chain feasibility
1. Document chosen algorithm, security parameter, license and upstream commit SHA.
2. Compare standard reference test vectors and Tidecoin-specific compatibility behavior.
3. Implement sign/verify and negative tests: changed message, wrong key, malformed signature, replayed context.
4. Sign a canonical release manifest including project ID, version, hash, timestamp and domain separation.
5. Publish reproducible local test commands and results.

## Milestone B0: On-chain feasibility gate
1. Define protected assets and threat model.
2. Benchmark verifier compute units, binary size, memory and transaction limits on Solana Devnet.
3. Confirm program-owned vault custody and authorization cannot be bypassed via direct SPL transfer.
4. Specify nonce, expiry, program ID, chain context, recipient, amount and vault ID in signed messages.
5. Stop if verification is impractical; never replace on-chain authorization with a trusted off-chain check without explicitly changing the security claim.

## Acceptance criteria
- Reproducible tests and source/license attribution.
- No mainnet deployment or custody of valuable assets.
- Security limitations documented.
