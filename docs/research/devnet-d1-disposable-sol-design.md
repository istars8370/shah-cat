# Devnet D1 Disposable SOL Smoke Test Design

Status: DESIGN ONLY / NOT EXECUTED

## Objective
Prove a minimal Devnet transaction path using only disposable, Devnet-only SOL and a fresh ephemeral keypair.

This gate does **not** validate:
- SHAH token transfers
- Guardian custody
- Treasury authorization
- Falcon/PQC authorization
- production wallets
- mainnet

## Safety boundary
D1 must use:
- a fresh disposable Devnet-only sender keypair
- a separate disposable Devnet-only recipient
- faucet-funded Devnet SOL only
- a small transfer amount
- no reused wallet keys
- no production seed phrases
- no Treasury keys
- no SHAH mint or token accounts

Private key material must never be committed, printed, uploaded as an artifact, or persisted beyond the run.

## Proposed steps

1. Verify Devnet identity using the D0 genesis check.
2. Generate a fresh ephemeral sender keypair in the CI runner or local test environment.
3. Generate a separate ephemeral recipient keypair/address.
4. Request Devnet airdrop to the sender.
5. Confirm sender balance after airdrop.
6. Build a small System Program SOL transfer.
7. Submit the transaction to Devnet.
8. Wait for finalized confirmation.
9. Independently query the transaction receipt by signature.
10. Verify:
   - network remains Devnet
   - transaction finalized
   - sender/recipient match expected ephemeral identities
   - transferred lamports match the test amount
   - transaction reports no error
11. Emit structured evidence containing only public metadata.
12. Discard the ephemeral private keys.

## Suggested transfer amount
Use the smallest practical non-zero amount that remains clearly observable after fees.

Do not hard-code any real wallet address.

## Evidence record
Public evidence may include:
- gate: D1
- repository commit SHA
- Devnet genesis hash
- transaction signature
- finalized slot
- sender public key
- recipient public key
- lamports transferred
- pre/post public balances
- transaction status
- read-only receipt verification result

Never include:
- secret key bytes
- seed phrases
- private-key files
- environment variables containing secrets

## Failure policy
D1 is FAIL if:
- genesis does not match Devnet
- faucet request fails and no Devnet-only balance is available
- transaction submission fails
- finalized confirmation is not reached
- receipt does not match sender/recipient/amount
- any production or reused key is involved
- private key material is printed or persisted

Do not retry automatically with different networks or production funds.

## Acceptance criteria
D1 can be marked PASS only when:
1. D0 identity verification passes in the same run.
2. Sender and recipient are newly generated ephemeral Devnet-only identities.
3. Funding comes from Devnet faucet only.
4. One small SOL transfer finalizes successfully.
5. Receipt is independently queried and matches the intended transaction.
6. Public evidence is recorded without secret material.

## Explicit non-claims
A D1 PASS proves only that a basic disposable SOL transaction path works on Devnet.

It does not prove Guardian recovery, SHAH custody, Treasury safety, Falcon verification, release readiness, or mainnet readiness.
