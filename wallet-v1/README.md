# SHAH Wallet 1.0 RC — Solana Devnet

SHAH CAT의 흑백 원형 고양이 로고를 사용하는 **독립형 전용 월렛 웹 화면**입니다. 이전 `feature/shah-wallet` 프로토타입을 계승하며, 기존 `dashboard/`의 테스트된 Wallet Standard·Phantom·Solflare 연결, 토큰 설정·Devnet 잔액·ATA·수수료·서명 없는 시뮬레이션을 재사용합니다.

> **중요:** 이 버전은 **Devnet의 공개 주소 연결·조회·검증에 특화된 Release Candidate**입니다. 실제 전송을 수행하거나 비밀키를 저장하는 정식 자산보관 월렛이 아닙니다. 코드 리뷰, 실제 Phantom/Solflare 브라우저 테스트 및 별도 보안 감사를 거치기 전에는 생산환경 배포나 Mainnet 사용을 금지합니다.

## Windows에서 실행하기

Node.js 20 이상 필요. 별도 패키지 설치 없음.

1. GitHub에서 `feature/shah-wallet-v1-20261025` 브랜치의 코드를 받아 별도의 폴더에 둡니다.
2. 해당 저장소 폴더에서 CMD를 열어 다음 두 명령을 각각 실행합니다.

```bat
set PORT=4184
node wallet-v1/server.mjs
```

3. Chrome/Whale 같은 데스크톱 브라우저에서 **http://127.0.0.1:4184**를 엽니다. 서버를 실행한 CMD 창은 닫지 마세요.
4. 브라우저에서 Phantom 또는 Solflare 확장을 설치하고 Devnet 계정을 선택한 뒤 **지갑 연결**을 누릅니다. 또는 아래 **공개 주소로 조회**에서 읽기 전용 공개 주소를 입력합니다.
5. SHAH·SOL 잔액은 Devnet JSON-RPC에서 읽습니다. **거래내역 조회**를 눌러 최근 활동을 확인하고, 공개 주소를 로컬 주소록에 등록할 수 있습니다.
6. 전송 검증은 수신 주소와 SHAH 수량을 넣고 **입력 검증 → 실제 수수료 시뮬레이션**을 누릅니다. 지갑이나 거래 서명 요청은 없어야 합니다.

## 구현 기능

- 브랜드: 공식 SHAH CAT 토큰 로고와 반응형 검정·오프화이트 전용 월렛 UI.
- 연결: Wallet Standard, Phantom·Solflare 확장 선택, 계정 변경·연결 해제, 조회 중 계정 변경 시 오래된 응답 무효화.
- 관찰 모드: **공개 주소만 입력**해 Devnet 잔액·거래내역을 살펴보기. 관찰 주소는 서명 권한이 아님.
- 잔액: 서버가 Devnet genesis와 SHAH SPL Mint를 검사하는 `GET /api/wallet` 조회.
- 거래내역: `GET /api/wallet-history`로 현재 존재하는 SHAH 토큰 계정의 최근 서명을 한정 조회. 발신·수신은 소유자 잔액 변화로 계산하며 확인된 거래는 Explorer로 연결.
- 주소록: 공개 Solana 주소·최대 40자 별칭, 최대 20개, 브라우저 `localStorage`에만 저장. 서버·GitHub·텔레그램으로 보내지 않음.
- 안전한 시뮬레이션: 기존 Dashboard의 `GET /api/quote` 사용. 계정 상태, ATA 존재·생성 비용, 네트워크 수수료 및 서명 없는 Devnet `simulateTransaction` 결과를 보여줌.
- 보안: 로컬 127.0.0.1 바인딩, 불필요한 원격 JS/CDN 없음, 엄격한 Wallet HTML CSP, GET-only 서버, 주소·Mint·genesis·시간 검증, 시뮬레이션 오염·오래된 응답 차단.

## 명시적인 제한

- **실제 송금·지갑 서명·시드 생성·복구·프라이빗 키 가져오기·잔고 커스터디: 지원하지 않음.** 전송 버튼 비활성화. Wallet Standard 연결 승인과 토큰 전송 서명은 완전히 별개.
- **Mainnet, Token-2022, 스왑, 브리지, 스테이킹, NFT 관리, 양자내성암호 도입: 이 빌드 범위 아님.**
- 거래내역은 저장된 최신 체인 상태에서 **현재 존재하는** 토큰 계정당 최근 12개 서명, 최대 8개 활성 계정만 스캔하며 최대 12개 거래를 조사합니다. 폐쇄된 ATA, 오래된 기록, 대량·복합 거래나 일부 RPC 누락은 표시되지 않을 수 있습니다. 세무·법률적 원장 아님.
- 주소록은 현재 브라우저 프로필 내 공개 주소만 저장하며, 동기화/백업되지 않습니다. 기기를 공유하면 주소록 별칭이 노출될 수 있습니다.
- Solana Devnet의 공용 RPC는 일시적 지연·429를 반환할 수 있습니다. 재시도하거나 RPC를 별도 구성하세요. 유효한 시뮬레이션 결과가 미래의 실거래 성공을 보장하지 않습니다.
- 서명·실제 Devnet 송금 구현은 **Release Gate 3에서 별도 사전 보안 검토, 명시적 이용자 확인 및 CI/실사용 검증**을 거쳐야 합니다. 이번 PR에 포함하거나 자동으로 활성화하지 않습니다.

## 구조와 검증

| 파일 | 역할 |
| --- | --- |
| `index.html`, `wallet.css`, `wallet.js` | 독립적인 SHAH Wallet 브랜드 UI / 공개 지갑 관찰 |
| `model.js` | 순수 주소록·잔액·시뮬레이션·거래내역 응답 검증 |
| `history.mjs` | Devnet 공개 RPC에서 한정된 지갑별 SHAH 거래내역 읽기 |
| `server.mjs` | 로컬 월렛 전용 서버; Dashboard의 읽기 전용 API 재사용 |
| `wallet-v1.test.mjs` | Node 기반 데이터 검증·서버·거래내역 안전 회귀 테스트 |

```bat
node --test wallet-v1\*.test.mjs
```

GitHub Actions에서 Dashboard 회귀 테스트, Solana 공식 SDK 바이트 동등성 검증과 월렛 신규 회귀 검사를 **별도 job**으로 실행합니다. 이번 빌드의 실제 Phantom·Solflare 확장 및 외부 Devnet 경로는 사용자 PC에서 추가로 확인해야 합니다.

## 개발 근거

- 원형 시제품: `feature/shah-wallet/wallet-prototype/`
- 최신 공통 Devnet 엔진: `dashboard/shared.js`, `dashboard/wallet-connectors.js`, `dashboard/server.mjs`
- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)

코드는 **기존 `main`에 직접 병합하지 않으며** 별도의 PR에서 검토합니다.
