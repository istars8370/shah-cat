# Four-Way performance and fee gate

This PR adds a Node.js off-chain Ed25519 evidence and policy microbenchmark only. It does NOT measure Falcon-512, SBF compute units, actual Solana transaction fees, memory or deployed binary size.

Run: `node --input-type=module -e "import('./research/four-way/benchmark.mjs').then(m=>console.log(m.benchmarkFourWay(1000)))"`

For real Solana feasibility: pin the Falcon verifier dependency and profile, build SBF with a reproducible toolchain, deploy to an isolated Devnet test program, collect compute units/heap/stack/binary size, measure transaction serialization and fees, run negative vectors and verify no custody bypass. No actual transaction or network operation has been performed by this PR.

No production or quantum-resistant claims are justified by this benchmark.
