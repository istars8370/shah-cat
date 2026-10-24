# SHAH CAT post-quantum A/B/C/D implementation gates

Status: **research only**. No existing SPL token, Phantom signing or SOL balance becomes quantum-resistant from these files.

## A — Falcon-512 off-chain test
- Prototype: `falcon-a1/src/main.rs` generates ephemeral keypairs and tests valid and modified messages/signatures.
- CI: `.github/workflows/shah-pqc-a1.yml` runs `cargo run --release --locked` on the research branch.
- **Gate A not passed** until workflow logs show successful dependency resolution, compilation and expected output. If lockfile is missing, generate and commit a reviewed lockfile before treating CI as reproducible.
- Add wrong-key, truncated-signature, context-replay and cross-profile negative tests before release.

## B — Release manifest signing
Canonical payload proposal (version 1, UTF-8, LF newlines, fixed order, no optional fields):
```
SHAH-CAT/RELEASE-MANIFEST/v1
project=shah-cat
network=devnet
version=<semver>
artifact_sha256=<64 lowercase hex chars>
created_unix=<decimal UTC seconds>
expires_unix=<decimal UTC seconds>
```
- Sign the exact bytes with the selected, explicitly versioned Falcon/Tidecoin profile.
- Publish manifest, signature, public verification key, upstream implementation commit and verifier instructions.
- Never distribute the verification key exclusively through the same untrusted channel as the artifact; establish a separately authenticated trust anchor.
- Reject invalid versions, expired manifests, incorrect project/network, malformed hashes and reused release identifiers.
- **Gate B not passed** until a real signed manifest verifies independently and negative tests pass.

## C — Solana SBF verifier feasibility
- Compile a verification-only implementation to the Solana SBF target, without key generation or private-key dependencies.
- Benchmark signature verification compute units, heap, stack, deployed binary size and serialized transaction size.
- Reject if runtime budget or input size makes verification impractical. Record toolchain, Solana version, dependency commit, exact signature format, logs and measurement methodology.
- **Gate C not passed**; no deployed on-chain verifier or benchmark results are present.

## D — Quantum-authorization vault specification (NOT DEPLOYED)
- Protected asset: a separately funded SPL token account owned by a program-derived authority, **not** a regular Phantom-controlled account.
- Deposits: user transfers into a vault-associated token account; vault program validates mint and token-program identity.
- Withdrawals: the program verifies a Falcon authorization for domain, cluster genesis hash, program ID, vault ID, mint, destination token account, amount, nonce, expiry and authorized key version.
- Store nonce state on-chain; enforce single-use, expiry, owner/authority constraints, destination and amount checks. Never trust a client-side-only signature verification result.
- Only the vault program may authorize vault-token-account transfers through PDA signer seeds; validate account ownership, derivations and token program on every instruction.
- Threats: key compromise, replay, program upgrade authority, malicious frontend, verifier bugs, signature malleability, fee starvation, token extensions, compute exhaustion and denial of service.
- Upgrades and emergency recovery require an independently reviewed governance policy; avoid undocumented admin bypass.
- No production custody, mainnet deployment or security claims before third-party audit and testnet adversarial testing.
- **Gate D not passed**; this is an architecture proposal, not a smart contract.

## Compatibility warning
Tidecoin legacy Falcon-512 and newer FN-DSA profiles are not necessarily wire compatible. Explicitly pin the algorithm profile, test vectors, code provenance and dependency versions. Do not advertise NIST-standard compatibility without evidence.
