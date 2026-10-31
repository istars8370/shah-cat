# SHAH CAT (SHAH)

**Small Cat. Infinite Worlds.**

SHAH CAT is an early-stage Solana token project developing wallet and operations tools and researching security technology. The v0.6 documentation direction separates the technology project from its game and character product economy.

The v0.6 documentation direction focuses on useful wallet and operations software, verified security research, and sustainable services. Character and game development remain separate product tracks.

## Official website and local tools

Start with Node.js 20+: `node dashboard/server.mjs`

- Official site: http://127.0.0.1:4173/site/
- Devnet dashboard: http://127.0.0.1:4173/
- Local Treasury: http://127.0.0.1:4173/treasury.html
- [Website implementation and safety boundaries](./docs/website-v0.1.md)
- [Web v0.3: public-only preview build and release safety checklist](./docs/website-v0.3-public-preview.md)
- Public static bundle (not deployed): `node scripts/build-public-site.mjs` → `dist/public-site/`

The server is localhost-only; no public website has been deployed. Never expose Treasury to the internet.

## Whitepaper and Tokenomics

- [Whitepaper v0.6 — adopted documentation baseline (백서 문서 기준안)](./WHITEPAPER.md)
- [Tokenomics v0.6 — adopted documentation baseline (상세 정책 문서 기준안)](./docs/tokenomics-v0.6-ko.md)
- [v0.6 changes, adoption checklist and research evidence (검토표)](./docs/tokenomics-v0.6-review.md)
- [Whitepaper v0.5 — preserved baseline (기존 백서)](./docs/whitepaper-v0.5-ko.md)
- [Tokenomics v0.5 — full policy (제5안 상세)](./docs/tokenomics-v0.5-ko.md)
- [Allocation comparison and vesting preview (배분·베스팅 조회)](./docs/tokenomics-dashboard.md)
- [Treasury policy approvals (지출 요청·지갑 서명 승인)](./docs/treasury-workflow.md)

The existing economic quantity and runtime policy baseline remains Tokenomics Proposal 5, dated October 25, 2026: 1 billion SHAH, preserved initial three-member allocations, separate operator/investor vesting, the CHURU off-chain game economy, and Treasury approval and disclosure rules. Publication does not establish three-party signed adoption, a mainnet launch, funded vesting, or deployed multisig controls. On October 27, 2026, Seongjae instructed adoption of v0.6 as the repository documentation baseline. Dongwon and Parkwon consent and an economic-policy effective date remain unconfirmed. It preserves all allocation quantities, vesting terms and the game pilot cap; service pricing, technical spending rules and disclosures require the applicable approvals before enforcement. Runtime approval messages still use v0.5. See the revision checklist for the reviewed main commit and unmerged research branches.

## Official Artwork

![SHAH CAT Official Logo](./샤아캣코인도안.png)

The official artwork preserves the original identity and distinctive silhouette of SHAH CAT.

## The SHAH CAT Universe

SHAH CAT is a small, mysterious black cat with the heart of a hero. Quiet and curious, SHAH explores new worlds and discovers extraordinary possibilities.

**Small Cat. Infinite Worlds.** represents the belief that even a small beginning can lead to an extraordinary journey.

## Token Development (Devnet)

- Blockchain: Solana
- Network: Devnet (testing only)
- Token name: SHAH CAT
- Symbol: SHAH
- Decimals: 9
- Verified test supply: 1,000,000,000 SHAH
- Devnet mint: `82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2`
- Metadata registration: Completed
- Mint authority: Development wallet (retained for testing)
- Freeze authority: None
- Wallet transfer test: 2,000 SHAH transferred successfully
- Mainnet token: Not launched

[View SHAH CAT on Solana Explorer](https://explorer.solana.com/address/82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2?cluster=devnet)

### Development Milestones

- [x] Create SPL token on Solana Devnet
- [x] Mint 1 billion test tokens
- [x] Register SHAH CAT metadata
- [x] Verify token supply and authority settings
- [x] Test token transfer to another wallet
- [ ] Document wallet security and token distribution
- [x] Build a Devnet token dashboard (Dashboard 2.0)
- [ ] Complete Mainnet readiness review

### Dashboard 2.0 — Release Gate 1 Complete

Status: Completed on October 22, 2026.

- Solana Devnet read-only dashboard
- Phantom wallet connect and disconnect
- SOL and SHAH wallet balance lookup
- Phantom account switching support
- Transfer input validation and preview only
- GitHub Actions CI: 61 tests passed, 0 failed
- Integrated into main via PR #3

Security boundaries:
- No wallet transaction signing
- No actual token transfers from the dashboard
- No private key or seed phrase collection
- No Mainnet deployment

Mainnet readiness review is still pending.

## Development Roadmap

### Track A — Brand and Community
- Establish the official character identity and brand guidelines
- Expand the SHAH CAT universe and storytelling
- Develop multilingual communication and community channels
- Explore original content, merchandise, and partnerships

### Track B — Technology and Ecosystem
- Complete Devnet token metadata and testing
- Review tokenomics, wallet security, and authority settings
- Evaluate legal and operational requirements before any mainnet launch
- Prototype community utilities and digital services
- Publish transparent project updates

## Project Status

SHAH CAT is in its early development and experimental stage. The Devnet token has no monetary value and is not a live investment product. Roadmap items are goals, not guaranteed deliverables.

## Official Repository

https://github.com/istars8370/shah-cat

---

SHAH CAT — Small Cat. Infinite Worlds.
