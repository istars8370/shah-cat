# SHAH CAT modern Solana SDK offline reference verifier (B-011)

Status: **PR #80 DRAFT / CI VERIFIED / NOT MERGED**. This is an offline development-test dependency, **not a production wallet or transaction sender**.

## Pinned reproducible toolchain

- Node.js 22 in GitHub Actions.
- `@solana/kit@6.10.0` and `@solana-program/token@0.10.0`, exact versions in `package.json`; `package-lock.json` is committed.
- `npm ci --ignore-scripts`, not an unlocked package install.

From the repository root:

```sh
npm ci --prefix tools/sdk-modern --ignore-scripts --no-audit --no-fund
npm test --prefix tools/sdk-modern
npm audit --prefix tools/sdk-modern --package-lock-only --audit-level=high
```

## Verified scope

CI confirms parity against the original immutable historical fixture `dashboard/fixtures/solana-sdk-reference.json`: 38 owner-to-ATA derivations and 6 legacy transfer scenarios (with and without ATA creation, 3 amount boundaries), matching instruction program/address/permission/data, compiled message bytes, and serialized **unsigned** transaction bytes. The guard additionally rejects any `bigint-buffer` entry and retired legacy SDK npm manifests.

- [PR #80 integrated change](https://github.com/istars8370/shah-cat/pull/80)
- [SHAH CAT CI run 40438737591](https://github.com/istars8370/shah-cat/actions/runs/40438737591) — PASS on previous PR head
- [SDK dependency guard run 40438737627](https://github.com/istars8370/shah-cat/actions/runs/40438737627) — PASS on previous PR head

## Boundaries and release decision

This verifier **does not** prove arbitrary transactions, Token-2022, multisig, signed wallet flows, RPC execution, Guardian custody, Falcon authorization or Mainnet safety. The old reference fixture remains unchanged and may only be regenerated after an independent human-reviewed procedure. The old SDK generator source is archived, not runnable with repository-managed legacy dependencies.

**NO GO until human code review and a fresh green CI on the latest PR #80 head.** Do not auto-merge, sign, submit RPC transactions, move assets, alter Treasury authority or deploy to Mainnet. B-011 remains OPEN until verified integration into `main`.
