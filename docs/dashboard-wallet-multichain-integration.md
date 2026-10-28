# SHAH Dashboard 2.0 ↔ SHAH Wallet 1.1 연동 (Devnet + Mainnet 읽기 전용)

## 2026-10-29 단계적 이식

기존 Wallet/Dashboard 통합 패키지의 후속 작업입니다. 실행자: Codex.
기준은 #89의 `fd40a73411f1267c8663cef80c5aa76ae0758b2a`, 이식 소스는
#23의 `ee5f9c1b431788bb0fdc21426193ca73f98da437`입니다.
#89에는 이미 #67 consent 수정과 #80·#83 보안 main이 반영되어 있습니다.
기존 checkout과 미커밋 변경을 보존하고 독립 worktree에서 개발했습니다.

- #23 전체 브랜치를 병합하거나 구버전 Dashboard 파일로 덮어쓰지 않았습니다.
  현재 Tokenomics/vesting 메뉴·스크립트를 유지하며 UI 충돌을 해결했습니다.
- 서버는 현재 `createRequestHandler`의 세 번째 Treasury store 인자를 유지하고,
  테스트용 멀티체인/이력 어댑터만 네 번째 options 인자로 추가합니다.
  Treasury 라우팅·권한, quote/preflight, Devnet RPC, SDK 및 보안 게이트는 미변경입니다.
- 새 Mainnet HTTP 오류는 400/409/502의 고정 메시지를 반환합니다. 이력은
  현재 hardened Devnet RPC를 사용하며 기존 오류 원문 비노출 정책을 유지합니다.
- #23에 포함된 #62의 clipboard 응답 경쟁 상태 수정과 회귀 검사를 함께 이식했습니다.
  #89의 EVM consent 코드는 변경하지 않았습니다.
- 모바일은 현재 일곱 메뉴를 보존해 네 열·두 줄로 배치했습니다.
  Wallet 회귀 workflow는 Dashboard 변경에도 실행되도록 경로를 확장했습니다.

검증 환경: Windows Node 24.22.1, 로컬 test runner는 `--test-isolation=none`.

- PASS: Dashboard + Wallet + Four-Way **494/494**, FAIL/SKIP 0.
- PASS: guarded offline security **249/249**, FAIL/SKIP 0. suite가 겹치므로 합산하지 않습니다.
- PASS: 새 same-origin 통합 검사 **9/9** (494개에 포함), 실제 localhost HTTP
  smoke tests, syntax 및 diff check. 기존 Treasury API/저장소 회귀도 전체 suite에서 통과했습니다.
- PASS: IAB에서 `/` → `/wallet` → `/dashboard` 왕복, Tokenomics 화면 렌더링,
  잘못된 EVM 주소 거절. 합성 공개 주소 `0x1111111111111111111111111111111111111111`의
  Ethereum Mainnet ETH/USDC/USDT가 새 API를 통해 실제로 표시됐습니다.
- PASS: 390×844 및 1280×900 viewport에서 가로 넘침 없음
  (문서 폭 각각 375/1265, scrollbar 제외). 최종 브라우저 warning/error 로그 0건.
- NOT RUN: 이번 후보의 다른 세 체인 live 비교, 독립 Explorer 대조,
  설치된 Phantom/EVM 확장 승인·거절·계정 전환, 실제 휴대폰 및 외부 감사.
  기존 #89에서 기록한 실제 확장/Explorer QA HOLD를 해소한 것으로 간주하지 않습니다.
- 실제 서명·전송·키 접근·Treasury 권한 변경·배포·병합은 수행하지 않았습니다.

검증 화면: [데스크톱](screenshots/dashboard-wallet-desktop-20261029.png),
[모바일](screenshots/dashboard-wallet-mobile-20261029.png).
최종 head의 원격 CI 결과는 PR 본문에 별도 기록합니다.

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

GitHub CI는 기존 Dashboard·Wallet·SDK 회귀 검증에 통합 화면·same-origin API·CSP·잘못된 체인 입력·공개 주소 복사/무효화 검사를 추가합니다. 이번 이식에는 별도 Live Mainnet Probe workflow를 복사하지 않았습니다. 자동 mock 테스트는 실제 개인 PC의 지갑 확장 프로그램 테스트를 대체하지 않습니다.

## 병합 순서

1. [보안 Wallet 통합 PR #89](https://github.com/istars8370/shah-cat/pull/89)의 실제 확장 지갑·Explorer QA와 인간 검토를 완료합니다.
2. 이 Dashboard 연결 Draft는 #89 위에 쌓아 검토합니다. 부모 변경 시 최신 head 충돌·회귀를 다시 확인합니다.
3. main에 반영할 때 필수 security checks·인간 승인·최신 기준 검증을 따릅니다. 자동 병합하지 않습니다.

원본 #20/#22/#23/#67/#87과 브랜치는 보존합니다. 원본 PR을 자동 종료하지 않습니다.

이 작업은 Devnet/메인넷 계정 이동이나 지갑 서명을 발생시키지 않습니다.
