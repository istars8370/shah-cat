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
| B-011 | SDK tool dependency advisories | RESOLVED for maintained SDK verification by #80/#86 at main 87e5179; legacy install manifests retired, full modern lock audit zero vulnerabilities, runtime-input byte checks preserved. |
| B-012 | Wallet final integration QA | OPEN: isolated #89 includes current security main and selected #67 fix; local 475 tests and four-chain read-only RPC pass. Installed extension QA and independent explorer comparison remain incomplete. |
| B-013 | Enforced security checks | CLOSED for observed `main` configuration and exact-head CI as of 2026-10-29 KST: active ruleset 25586369 requires three green check contexts, strict up-to-date checks, one approving review, thread resolution and no bypass actors; main `9d9734e` required jobs PASS. This is not an external audit or a live attempted-policy-bypass test. |

Historical B-011 included `bigint-buffer` GHSA-3gc7-fjrx-p6mg (buffer overflow in toBigIntLE), propagated through @solana/buffer-layout-utils and @solana/spl-token. Both old SDK tools reported 3 high / 6 moderate affected-package entries, with overlap. #80 retired four install manifests/lockfiles while preserving archived source and frozen fixtures. These historical findings are not the current maintained dependency graph. Modern packages remain CI verifiers, not production curve replacements. #86 explicitly records one noncanonical all-ff curve difference; runtime ATA derivation continues rejecting it. This does not establish universal SDK compatibility, signed supply-chain provenance or external audit. Do not run npm audit fix --force or revive archived installs.

D1 remains separately scoped: fresh ephemeral Devnet-only keys, faucet SOL only, no SHAH/Treasury/custody, no secrets persisted/logged, independent receipt verification. Queue entries do not grant transaction authorization.

## B-013 verification evidence (2026-10-29 KST; read-only settings inspection)

- GitHub [ruleset 25586369](https://github.com/istars8370/shah-cat/rules/25586369), `SHAH-CAT-MAIN-PROTECTION`: `enforcement=active`, branch condition `~DEFAULT_BRANCH`, `bypass_actors=[]`; deletion and non-fast-forward prevention rules are present.
- Pull-request rule: one approving review, stale-review dismissal after pushes, last-push approval and review-thread resolution required.
- Required status contexts, checked with GitHub REST ruleset API: `Dashboard automated tests`, `Solana SDK byte equivalence`, `Stabilization security gate`; `strict_required_status_checks_policy=true`.
- [Main branch commit `9d9734ed98e33d696545f91b5f2c3af9f31ee495`](https://github.com/istars8370/shah-cat/commit/9d9734ed98e33d696545f91b5f2c3af9f31ee495) was observed with `protected=true`.
- On this exact main commit, [SHAH CAT CI run 40461174075](https://github.com/istars8370/shah-cat/actions/runs/40461174075) reports both required Dashboard and SDK jobs SUCCESS. [Stabilization verification run 40461174047](https://github.com/istars8370/shah-cat/actions/runs/40461174047) reports required `Stabilization security gate` SUCCESS. `Devnet missing-ATA unsigned simulation` is SKIPPED and must not be treated as validated.
- [Workflow definition](https://github.com/istars8370/shah-cat/blob/main/.github/workflows/stabilization-gate.yml) runs on PR and main push and includes offline guarded checks, modern SDK byte regression/audit and retired-manifest rejection.
- Legacy `/branches/main/protection` API returned 403 `Resource not accessible by integration`; this is not evidence that the active *ruleset* is disabled. Ruleset detail GET succeeded and supplies the verified configuration. No attempt was made to weaken protections, test rejection by malicious PR, or change settings. Future rule edits or main-head changes require fresh inspection.
- Closure scope: GitHub configuration and exact-head CI evidence only. Does **not** close B-008 Guardian deployed execution, B-009 independent review, B-010 mainnet NO-GO, B-012 installed-wallet QA, or D1 execution HOLD.
