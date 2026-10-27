# Agent work lanes and handoff

Updated: 2026-10-27 KST. Adopted for this authorized efficiency/integration task.

## Availability and responsibility
| Lane | Current executor | Scope | Branch prefix |
|---|---|---|---|
| Integration and security coordination | Seongjae's ChatGPT, temporary acting owner | architecture, Guardian research, review, ops documents | `ops/`, `research/` |
| Wallet and Dashboard | owner named on each task | UI, public-address consent, regression QA | `feature/`, `collab/dashboard-*`, `collab/wallet-*` |
| CI and automation | Seongjae's ChatGPT acting during Gemini pause | workflows, offline tests, dependency findings | `ci/`, `ops/` |
| Gemini collaborator | PAUSED: account limit, per user instruction | no active assignment; resume with a verified handoff | `collab/gemini-*` |

These are execution lanes, not a permanent hierarchy or invented GitHub permissions. Dongwon's private conversations, credentials and schedules are not accessible shared state. Resuming Gemini requires rechecking this queue and existing PRs first.

## One source of truth
- `NOW.md`: maximum three active packages, task owner, acceptance and next step.
- `BLOCKERS.md`: unresolved evidence and security risks.
- GitHub PR/commit/check results: authoritative implementation evidence.
- `PROJECT_STATE.md`: last verified project checkpoint; inspect current refs before use.

Read changed PRs and CI since the last verified SHA first. Expand to full inventory only if dependencies, conflicts, security findings or release scope require it. Do not repeatedly re-audit all historical PRs.

## Work claim and conflict rules
One task has one acting owner, one objective and a named file scope. Before editing shared files, check other open PRs. Handoff records head SHA, touched files, tests, blockers and next action. A branch prefix is a routing convention, not an access-control boundary.

Do not close PRs based only on their numbers. Use ancestor checks against the actual merged commit; when content was rewritten, retain the original and record explicit supersession. Keep source branches for recovery.

## Permission and release boundaries
The user's 2026-10-27 request authorizes the reviewed operations/research integrations and superseded-PR cleanup performed here. It does not authorize Mainnet, real-fund transactions, Treasury movement, Guardian custody, Falcon authorization activation or a production release.

## Evidence and efficiency
Record PASS / FAIL / NOT RUN / BLOCKED for the exact scope. Internal tests and AI review are not an independent audit. No material change means no new PR, commit or repeated full report. Track weekly review time, merged packages, CI failure rate and reopened work before claiming any 3–5x speedup.
