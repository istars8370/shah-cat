# SHAH CAT Creative Studio — v0.2 Approval Pilot

Independent **local-only** Node.js 20+ prototype. No npm dependencies or wallet permissions. This is an experimental tool to support [Creative Studio pilot #94](https://github.com/istars8370/shah-cat/issues/94), **not** a released commercial platform.

## Quickstart (Windows PowerShell)

```powershell
cd creative-studio
node --version
node server.mjs
```

Open `http://127.0.0.1:4175` in the same PC. The HTTP server binds to **127.0.0.1 only**. The default **DEMO** mode provides a structured manual-writing template, **not AI-generated output**. Quotes are calculated without being saved. All prices shown are hypotheses, not firm offers.

## Approval workflow (#100, stacked on #99)

1. Click the fictional brand sample, choose Naver Cafe, Naver Blog or Discord, and supply brand/industry, purpose, audience, tone, post type, length and a brief. Confirm rights yourself. Never submit personal or sensitive information.
2. Generate a `DRAFT` containing editable post text, hashtags, channel metadata and an image-production prompt. DEMO reuses the v0.1 manual-writing template; length caps are 250/600/1200 characters. AI receives the length target as data and can exceed it: a person must edit/verify length. Images are never generated.
3. Edit the three output fields and **save**. Request review (`REVIEW_REQUIRED`), then confirm all five checks: edits, source rights, facts/privacy, commercial use and likeness consent (or no people).
4. Approve (`APPROVED`). Copy or download Markdown/JSON through the server gate (`EXPORTED`). The export always says `published:false`; manually review the destination's rules and advertising disclosures before posting yourself. There is no platform API or automatic posting.
5. Editing an approved/exported record resets it to `DRAFT` and clears checks. Unsaved edits disable export immediately. Saved revisions are checked on every action: concurrent/stale approvals and exports fail closed. Changing the brief requires a new draft. Failed/lost action responses discard the browser's local approval; regenerate and review again.

The handler keeps at most 24 temporary workspaces in process memory, expiring one hour after creation (purged on the next HTTP request). Restart clears everything; page reload loses the current workspace handle. No disk/database/browser storage or private customer ledger is added. Anyone controlling this local OS/process can act as the operator: this is **not authenticated multi-user approval**, proof of rights, or tamper-evident approval history. Work IDs are random capabilities; don't share them. Exported files/clipboard are explicitly created by the operator and must be kept in a suitable private location. The gate controls built-in copy/export; it cannot prevent manually copying visible draft text.

The legacy `/api/draft` text-template and `/api/quote` contracts remain available. Neither a legacy draft response nor visible text is an approved delivery. Workflow operations use `/api/workflow` and `/api/workflow/action`. POST callers must send the exact localhost Origin and `x-studio-request: 1`, plus a loopback Host. Unknown hosts, missing/foreign Origins, malformed/oversized JSON and stale revisions are rejected. Workflow JSON is limited to 64 KiB; legacy draft/quote retains its 8 KiB limit. Generation shares the existing 12 requests/10 minutes limit across both draft routes. Mock all AI calls in tests.

## Optional live text AI (server-side)

Requires your own active OpenAI API account and a supported model name. API calls may incur separate charges. The application itself does **not** provide a paid AI subscription.

```powershell
$env:OPENAI_API_KEY = 'YOUR_KEY_SET_LOCALLY'
$env:OPENAI_MODEL = 'YOUR_SUPPORTED_MODEL'
node server.mjs
```

The private key remains in the process environment; never enter it in the browser, GitHub, screenshots, or the order ledger. AI mode uses the OpenAI Responses API with `store:false`, 25-second request timeout, and a strict fixed upstream URL. The user must separately consent before each submitted brief is sent to the external provider. No images or videos are generated in v0.1; **image-prompt** creates text instructions only. Do not submit personal/sensitive customer data or materials without appropriate rights.

## Verify

```powershell
node --test creative-studio/server.test.mjs
```

Run from the repository root. Run smoke testing against the local page: open it, inspect `DEMO` vs `AI` mode, try a 15+ character sample brief, tick rights confirmation, test blocked cross-origin requests, calculate a negative-margin quote, and check that no payment or wallet flow exists.

## Safety and business rules

- No customer or payment data is persisted. This is **not** a CRM, order-management platform, public SaaS, or automated publishing tool.
- Only `127.0.0.1` is bound; there is no authentication/TLS. **Do not reverse-proxy or expose the app to the internet.**
- No SHAH transfer, signing, reward, real staking, token minting, SCC issuance or wallet storage. SHAH optional membership benefits and non-transferable SCC service credits remain **future proposals**, not live functions.
- Every draft needs human review for factual claims, privacy, commercial use rights, personality/likeness permissions, trademarks, fonts, music, and client approval.
- The quote calculation is paid receipts minus refunds, other cash direct costs, AI direct costs, revision costs, labor hours × hourly rate, and payment/support fees. Enter AI/revision costs separately, excluding them from other cash costs to avoid double-counting. Optional new cost fields default to zero only when omitted by legacy clients. Explicit strings, nulls, fractions, negative/nonfinite/out-of-range amounts fail. Internal SHAH work requires zero paid receipts and is labeled as a cost scenario; external orders are labeled separately. Negative contributions are shown as **적자**. Taxes, overhead, future/unentered costs remain excluded. This is not a payment, verified order, or proof of business revenue.
- For real orders use a **private** operational ledger and customer contract; do not commit them to public GitHub. See `docs/business/creative-studio-pilot.md` and `docs/business/creative-studio-orders.template.csv` (header only).
- Externally selling the Studio itself, handling API keys for other users, or connecting to paid customer systems requires authentication, quotas, privacy/retention controls, auditing and further legal/security review.

## Future gated work

1. Validate independent outside paid customers, delivery quality, cash margin and repeat purchase intention.
2. Add a private, authenticated order/rights ledger and evidence retention **outside** public GitHub, only after separate approval. The v0.2 temporary gate is not that ledger.
3. Introduce an AI provider router, budgets and cost metering; image/video generation only after rights review.
4. Read-only SHAH benefit preview / SCC usage counter only after product economics approval. No on-chain operation by this prototype.
