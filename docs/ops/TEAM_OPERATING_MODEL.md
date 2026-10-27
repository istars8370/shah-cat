# SHAH CAT Joint Development Operating Model

Updated: 2026-10-27 KST
Status: PROPOSED / HUMAN ROLE CONFIRMATION PENDING
Source: shared GitHub repository and command-center PR #52 (NOT YET MERGED TO main)

## Three layers

### Layer 1: Human co-owners
- The user and Seongjae are proposed as **joint collaborators**, not an assumed CEO/subordinate hierarchy.
- Each person may propose tasks, review evidence, and contribute code/design/documentation across tracks.
- Exact authority, GitHub handles, responsibility boundaries and approval policy require confirmation from both people.
- Neither participant's separate private ChatGPT conversation is accessible to the other's AI automatically.

### Layer 2: ChatGPT PM / architect / reviewer
- Read the latest GitHub evidence first, then sync `PROJECT_STATE.md`, `WORK_QUEUE.md`, `STATUS.md`, `NOW.md`, `BLOCKERS.md` as needed.
- Prioritize blockers and CI failures; maintain no more than **3 active P0** packages across **both** participants.
- Assign proposed owners only (no unilateral assignment to a named person).
- Convert accepted work to small, auditable work packages; explain dependencies, risks and acceptance tests.
- Verify CI and summarize reviewer actions; **do not self-approve high-impact changes**.
- Avoid recurring no-op commits and avoid adding a new PR when an existing issue/PR suffices.

### Layer 3: Codex / GitHub Actions
- Codex: implement, refactor, unit-test against explicitly scoped work packages. It must be connected and invoked by an authorized actor; ChatGPT automation does not imply live Codex orchestration.
- GitHub Actions: build, test, lint, scan and attach reproducible evidence; PASS is not approval.
- GitHub issues and draft PRs are handoff surfaces shared across independent ChatGPT accounts.

## Human approval matrix

| Action | Default | Required decision |
|---|---|---|
| Read-only analysis, tests, docs | AI may execute in bounded research scope | Review results |
| Scoped research branch, draft PR | AI may propose/submit | Human code review before integration |
| Main or high-impact integration merge | HOLD | Human approval by agreed repository maintainers |
| Wallet signing, Devnet SOL transfer, token transfer | HOLD | Separate explicit authorization and safety gates |
| Treasury, production custody, Falcon auth, Mainnet | NO-GO | Formal security/release gate, not merely an AI recommendation |
| Creative work publication or third-party media | HOLD until rights cleared | Creator/rights holder approval |

No implicit authorization is inferred from scheduling or a prior test PASS.

## Branches and conflict avoidance

- `main` is the released repository baseline.
- `ops/shah-cat-command-center` is a proposed coordination integration branch in PR #52, **not yet main**.
- `research/four-way-operations-checklist` is the Four-Way research integration candidate (PR #50).
- Work branches/PRs must target the correct parent and be rebased or reconciled according to dependency order.
- Do not create a parallel integration branch or close/merge stacked PRs automatically.
- Check for concurrent human/AI updates before each file write; use current blob SHA.

## Package contract
Each queued package must have:
- ID, priority, status, proposed/confirmed owner
- objective, dependencies and in-scope paths
- out-of-scope safety boundary
- exact validation/acceptance criteria
- proof (PR, commit, Actions) and reviewer/approval decision

## Loop per execution
1. Read queue/status/project state and latest relevant GitHub PR/CI only.
2. If an existing package is blocked on a human decision, prepare a concise review packet, do not spin on it.
3. Select **one** independent, safely executable package for a change.
4. Write minimum diff on correct branch, validate evidence, report PASS/FAIL/NOT RUN explicitly.
5. Update `STATUS.md` **only when material state changes**. Never forge a PASS or claim a merge without verifying.
6. End with a short digest: changed, evidence, blockers, human approvals needed, next <=3 tasks.

## Credit efficiency rules
- Run frequency is a maximum opportunity, not a mandate to commit.
- No redundant full-repo search, PR creation or CI re-run without a state change.
- When CI remains in_progress or the approval is pending, stop and record a checkpoint.
- ChatGPT cannot directly see account credit balance; no automatic consumption-based throttling is guaranteed.
- A high-frequency schedule should be reduced if outputs are repeated/no-op.

## Onboarding both people
1. Confirm GitHub user handles and access (only then assign or request review).
2. Each person can comment on shared issues and draft PRs to accept/modify work packages.
3. Decide whether sensitive approvals need one named maintainer or both co-owners.
4. Keep independent creative/QA track (#61) open to **either** person, not a predetermined role.
5. No shared ChatGPT session or private message sync is assumed.
