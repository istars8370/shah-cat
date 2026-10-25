# Canonical authorization envelope — research migration

The original research prototype hashes JSON.stringify(request), making key order potentially significant. This new helper defines a strict allowlist and fixed field order, but is deliberately **not yet wired** into Ed25519 evidence or existing audit records.

Before migrating: define a versioned byte protocol, cross-language Rust/JS golden vectors, backwards compatibility policy, replay domains and on-chain verifier. Never reinterpret existing signatures as canonical v1 signatures. The legacy and new formats are distinct and cannot be mixed.
