# Four-Way Verification Matrix v0.2

Status: RESEARCH VALIDATION MATRIX. Passing local/unit tests does not imply production readiness.

| ID | Area | Current evidence | Status |
|---|---|---|---|
| A01 | request/domain/expiry validation | executable research tests | PASS for research scope |
| A02 | elevated approval policy | local research tests | PASS for research scope |
| A03 | auxiliary signature binding | compatibility gate only | BLOCKED for authorization |
| B01 | guardian quorum logic | JS simulation tests | PASS for simulation only |
| B02 | durable recovery nonce | in-memory only | BLOCKED |
| B03 | trusted timelock | caller-provided time in JS | BLOCKED |
| B04 | authenticated cancel/rotation | not on-chain | BLOCKED |
| C01 | module allowlist/version behavior | executable research tests | PASS for research scope |
| C02 | fail-closed module behavior | adversarial tests | PASS for research scope |
| D01 | integrity chain verification | executable research tests | PASS for research scope |
| D02 | checkpoint forgery resistance | limitation demonstrated | BLOCKED without authenticated checkpoint |
| X01 | integrated Four-Way review | research integration tests | PASS for research scope |
| X02 | Devnet RPC identity/receipt checks | read-only tooling | PASS for read-only scope |
| X03 | real Guardian Devnet execution | no deployed Guardian program | BLOCKED |
| X04 | Falcon SBF runtime feasibility | verifier research exists; benchmarks absent | BLOCKED |
| X05 | independent external audit | absent | BLOCKED |

## Exit criteria
- G1: isolated research modules and adversarial tests exist.
- G2: integration tests pass on the final research integration head.
- G3: implemented Devnet program actions have reproducible public evidence.
- G4: external findings are documented and remediated or explicitly accepted.
- G5: human release decision is recorded.

## Evidence discipline
Mark each item as PASS only for the exact tested scope. Use BLOCKED where a required program, runtime measurement, trust anchor or independent review does not yet exist.

This matrix supersedes the earlier planned-only PR #27 test matrix once merged into the Four-Way integration branch.
