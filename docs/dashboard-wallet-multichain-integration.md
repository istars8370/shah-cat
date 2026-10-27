# SHAH Dashboard 2.0 ↔ SHAH Wallet 1.1 연동 (Devnet + Mainnet 읽기 전용)

## 구조

이 변경은 두 화면을 **같은 로컬 웹 서버의 동일 오리진**에서 사용할 수 있게 연결합니다.

| 화면 | URL | 제공 기능 |
| --- | --- | --- |
| SHAH CAT 운영 대시보드 | `/` 또는 `/dashboard` | 기존 Devnet SHAH 운영·잔액·전송 시뮬레이션·장부 |
| SHAH 전용 월렛 1.1 | `/wallet` | Devnet SHAH·주소록·전송 점검 및 Solana/EVM Mainnet 자산 조회 |
| Dashboard 멀티체인 패널 | `/#multichain-section` | SHAH Wallet과 동일한 공식 USDT·USDC 등록 목록과 GET-only 메인넷 조회 API |

- **Dashboard**에는 상단 `SHAH Wallet 1.1` 링크와 사이드바 `멀티체인` 메뉴가 생깁니다.
- 메인넷 패널에서는 Solana Mainnet (SOL·USDC·USDT), Ethereum (ETH·USDC·USDT), Base (ETH·USDC), Polygon PoS (POL·USDC)의 **공개 주소만** 조회합니다.
- 메인넷 자산은 기존 `SHAH Devnet 10억 개 공급량`·지갑·전송 검증·운영 장부와 절대로 합산하지 않습니다.
- **Solana Mainnet**을 선택한 경우 `연결된 Solana 주소 사용` 버튼으로 대시보드에 연결한 지갑의 **공개 주소 문자열만** 복사할 수 있습니다. 조회는 다시 버튼을 눌러야 하며 토큰 잔액이나 서명 권한은 공유되지 않습니다.
- EVM 네트워크는 공개 주소 직접 입력 또는 EIP-1193 확장 지갑의 `eth_requestAccounts` 주소 공개 승인만 사용합니다. 지갑 네트워크 자동 전환·서명·전송은 전혀 없습니다.
- `/wallet`에서 `운영 대시보드로 이동`을 누르면 `/dashboard`로 돌아갑니다.

## Windows 실행

SHAH Wallet 1.1 통합 소스를 내려받아 저장소 **루트**에서 다음 명령을 실행합니다.

```bat
set PORT=4186
node dashboard/server.mjs
```

브라우저에서 `http://127.0.0.1:4186`을 열면 Dashboard, `http://127.0.0.1:4186/wallet`을 열면 Wallet 1.1입니다. CMD 창은 서버 실행 중 계속 열어두어야 합니다. `node wallet-v1/server.mjs`으로 실행하더라도 대시보드 `/dashboard`와 동일 API를 이용할 수 있습니다.

> 반드시 **통합 브랜치 전체**를 받으세요. 기존 Dashboard 폴더의 파일만 복사하면 Wallet 모듈이 없기 때문에 동작하지 않습니다.

## 기술·보안

- 대시보드 서버 `dashboard/server.mjs`는 월렛 정적 리소스를 허용 목록으로만 제공합니다. 월렛 페이지에는 CSP(`script-src 'self'`, `frame-ancestors 'none'`)가 추가됩니다.
- `GET /api/multichain?chain=...&address=...`는 월렛과 대시보드에서 **동일한 read-only 어댑터**를 사용합니다. 네트워크별 Solana genesis / EVM Chain ID 확인 후만 잔액을 조회합니다.
- `GET /api/wallet-history`는 Devnet 월렛의 제한된 SHAH 거래내역 조회에만 사용합니다.
- 스테이블코인의 컨트랙트·Mint는 `wallet-v1/multichain-registry.js`의 Circle / Tether 공식 식별자 허용 목록에서 가져옵니다. 사용자 임의 토큰 입력이나 서로 다른 네트워크 잔액 합산을 지원하지 않습니다.
- 스크립트에서 서명 API, 지갑 개인키, 토큰 전송, 스왑, Mainnet 트랜잭션 전송은 제공하지 않습니다.
- 공용 메인넷 RPC는 호출 제한·응답 실패·개인정보(공개 주소 + IP) 노출 위험이 있습니다. 검증 실패 시 잔액을 0이라고 표시하지 않고 오류를 표시합니다.
- 확인된 Devnet 토큰은 실제 투자 자산으로 분류하거나 메인넷 가치에 합산하지 않습니다.

## 검증

```bat
node --test dashboard/*.test.mjs
node --test wallet-v1/*.test.mjs
```

GitHub CI는 기존 Dashboard·Wallet·SDK 회귀 검증에 통합 화면·same-origin API·CSP·잘못된 체인 입력·공개 주소 복사/무효화 검사를 추가합니다. 별도 GitHub Live Mainnet Probe가 실제 공개 RPC 조회를 확인하지만 **실제 개인 PC의 지갑 확장 프로그램 테스트를 대체하지 않습니다**.

## 병합 순서

1. [SHAH Wallet 1.0 PR #20](https://github.com/istars8370/shah-cat/pull/20) 독립 검토·병합
2. [Multi-chain Wallet 1.1 PR #22](https://github.com/istars8370/shah-cat/pull/22) `main` 기준 재설정 후 검토·병합
3. **이 Dashboard 연결 PR**을 `main` 기준으로 재설정하고, 기존 tokenomics/vesting 패널과 충돌하지 않는지 검증한 뒤 **명시적 승인** 후 병합

이 작업은 Devnet/메인넷 계정 이동이나 지갑 서명을 발생시키지 않습니다.
