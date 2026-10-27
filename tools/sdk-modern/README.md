# Modern Solana SDK parity candidate

This directory is a draft SDK comparison candidate for B-011. It is not used by the dashboard and is not approved for merging.

Acceptance: reproduce the six frozen message/wire vectors and 38 ATA owner vectors using the modern SDK, generate a deterministic lockfile, and pass an npm dependency audit with no bigint-buffer. Do not sign or broadcast transactions.

The test implementation and dependency versions remain unverified. Keep this candidate isolated until CI demonstrates parity.
