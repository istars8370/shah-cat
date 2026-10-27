# SHAH CAT blockers

Updated: 2026-10-27 KST.

| ID | Blocker | Status / evidence |
|---|---|---|
| B-001 | Architecture source split / research integration | CLOSED for research: #53 and #50 merged, canonical docs and original #27 retained |
| B-002 | Guardian stable PDA identity | IMPLEMENTED in #56 branch; actual runtime validation not established here |
| B-003 | Authenticated Guardian recovery | IMPLEMENTED in #57 branch; execution/security evidence still required |
| B-004 | Replay/timing coverage | #58 branch tests; no new independent or deployed-program evidence established here |
| B-005 | D0 read-only evidence | Historical run 40383873297 reported PASS; #59 remains unmerged, verify on final integration |
| B-006 | D1 disposable SOL test | DESIGN ONLY in #60, no transfer executed |
| B-007 | Falcon/PQC compatibility | BLOCKED: vectors, reproducible build, SBF benchmarks and trust-anchor review missing |
| B-008 | Deployed Guardian execution | BLOCKED: no approved deployed program evidence |
| B-009 | Independent external review | OPEN; AI/CI review is internal |
| B-010 | Mainnet release | NO-GO |
| B-011 | SDK tool dependency advisories | OPEN: each tool audit has 3 high / 6 moderate affected-package entries; counts overlap and are not unique vulnerabilities |
| B-012 | Wallet final integration QA | OPEN: #20 -> #22 -> #23 and #67; #62 fix integrated into parent only |

B-011 includes `bigint-buffer` GHSA-3gc7-fjrx-p6mg (buffer overflow in toBigIntLE), propagated through @solana/buffer-layout-utils and @solana/spl-token. These are SDK development/reference dependencies, not proof that the Dashboard runtime is exploitable. Do not run npm audit fix --force; proposed semver-major/downgrade remediation needs compatibility review and byte-equivalence tests.

D1 remains separately scoped: fresh ephemeral Devnet-only keys, faucet SOL only, no SHAH/Treasury/custody, no secrets persisted/logged, independent receipt verification. Queue entries do not grant transaction authorization.
