# SHAH CAT Devnet transaction evidence runbook

## Prerequisites
Use a NEW throwaway Solana keypair on the operator's own machine, not the SHAH Treasury wallet. Never paste private keys, mnemonic phrases or keypair JSON into ChatGPT, GitHub, screenshots or logs.

Install and verify official Solana CLI on a trusted machine. Confirm `solana config get` shows Devnet, and explicitly use `--url https://api.devnet.solana.com` for all commands. Verify the generated address and faucet balance before proceeding.

## Basic live transaction smoke test (NOT Guardian validation)
1. `solana-keygen new --outfile ./devnet-throwaway.json` (local only; protect and never commit this file).
2. `solana address --keypair ./devnet-throwaway.json`
3. `solana airdrop 1 --url https://api.devnet.solana.com --keypair ./devnet-throwaway.json` (faucet may rate-limit).
4. `solana transfer <NEW_SEPARATE_DEVNET_RECIPIENT> 0.001 --allow-unfunded-recipient --url https://api.devnet.solana.com --keypair ./devnet-throwaway.json`
5. Capture the resulting transaction signature; independently check `solana confirm <SIGNATURE> --url https://api.devnet.solana.com -v` and Solana Explorer Devnet.
6. Verify the signature with `verifyDevnetReceipt` from `research/four-way/devnet-receipt.mjs`. This verifier makes read-only RPC calls.

This smoke test proves a real Devnet SOL transfer only, NOT SHAH mint transfers, Falcon verification, program custody or Guardian recovery. Do not claim those until the actual on-chain program is built, deployed and its own positive/negative transactions are independently verified.
