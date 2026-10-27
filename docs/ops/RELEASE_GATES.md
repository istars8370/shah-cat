# SHAH CAT Release Gates

Updated: 2026-10-27 KST

This document converts current blockers into explicit PASS/FAIL evidence requirements.

## RG-1 — Research integration consistency
Current: **PASS for isolated research integration only**

Evidence: #53 + #50 merged; final head d6f62a46292653579b63b0bf4621c42877e12228 passed research and SHAH CAT CI (40429598172 / 40429598114). Main integration f163bad7c20fc8244407b1bec1875518b25f0c41. This does not satisfy RG-2 through RG-6.

PASS requires:
- one declared Four-Way architecture source of truth
- PR #27/#50 relationship resolved
- final integration diff reviewed
- relevant CI PASS on final head

Evidence:
- merged/superseded architecture document
- PR review note
- workflow run IDs

## RG-2 — Guardian implementation boundary
Current: **FAIL**

PASS requires:
- implementation boundary documented
- authenticated recovery authority model
- persistent replay protection
- trusted timing source
- positive and negative tests
- reproducible local validator or Devnet evidence for the actual Guardian program

Evidence:
- implementation PR
- test logs
- program/build identity
- transaction evidence for approved Devnet scope

## RG-3 — Falcon/PQC compatibility
Current: **FAIL**

PASS requires:
- one explicitly named signature/profile format per verification path
- test vectors with provenance
- cross-check demonstrating intended compatibility or explicit incompatibility
- reproducible build information
- performance/resource measurements for the intended runtime
- limitations documented

Evidence:
- compatibility matrix
- test-vector results
- benchmark output
- implementation/review PR

## RG-4 — Devnet operational validation
Current: **FAIL**

PASS requires:
- exact scope declared before execution
- transaction or program action generated on Devnet for that scope
- independent receipt verification
- expected state transition confirmed
- negative/failure case captured where applicable
- no production wallet or mainnet dependency

Evidence:
- transaction signature(s)
- receipt verification output
- before/after state evidence
- run log with commit/program identity

A basic SOL transfer may satisfy only a network smoke-test sub-gate. It does not satisfy Guardian, Falcon/PQC or SHAH custody validation.

## RG-5 — Independent external review
Current: **FAIL**

PASS requires:
- reviewer scope agreed
- findings documented
- critical/high findings resolved or explicitly accepted
- remediation evidence linked

Evidence:
- external review report
- finding tracker
- remediation PRs

## RG-6 — Mainnet release
Current: **NO-GO**

PASS requires:
- RG-1 through RG-5 PASS where applicable
- final release candidate identified
- release checklist complete
- explicit human approval

No AI, CI run, prototype, or document alone can authorize this gate.

## Decision rule
Production/mainnet remains NO-GO while any mandatory gate is FAIL, HOLD, BLOCKED, or unevidenced.
