# SHAH CAT Creative Studio — v0.1 Local Pilot

Independent **local-only** Node.js 20+ prototype. No npm dependencies or wallet permissions. This is an experimental tool to support [Creative Studio pilot #94](https://github.com/istars8370/shah-cat/issues/94), **not** a released commercial platform.

## Quickstart (Windows PowerShell)

```powershell
cd creative-studio
node --version
node server.mjs
```

Open `http://127.0.0.1:4175` in the same PC. The HTTP server binds to **127.0.0.1 only**. The default **DEMO** mode provides a structured manual-writing template, **not AI-generated output**. Quotes are calculated without being saved. All prices shown are hypotheses, not firm offers.

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
- The quote calculation is net paid receipts minus cash direct costs, labor hours × hourly rate, and payment/support fees. It excludes taxes, overhead, future revision costs and any unrecorded refunds. Do not count SHAH allocations as cash revenue.
- For real orders use a **private** operational ledger and customer contract; do not commit them to public GitHub. See `docs/business/creative-studio-pilot.md` and `docs/business/creative-studio-orders.template.csv` (header only).
- Externally selling the Studio itself, handling API keys for other users, or connecting to paid customer systems requires authentication, quotas, privacy/retention controls, auditing and further legal/security review.

## Future gated work

1. Validate independent outside paid customers, delivery quality, cash margin and repeat purchase intention.
2. Add approval workflow and private order/rights ledger **outside** public GitHub.
3. Introduce an AI provider router, budgets and cost metering; image/video generation only after rights review.
4. Read-only SHAH benefit preview / SCC usage counter only after product economics approval. No on-chain operation by this prototype.
