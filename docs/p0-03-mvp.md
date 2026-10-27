# P0-03: Devnet MVP 구현 초안과 개발 계획

확인일: 2026-10-27 KST. 기준 main: `fab83762da8aed49bfc7983136526643dc0827a6`.
작업 브랜치: `codex/p0-03-devnet-mvp`. 담당: 이 요청을 수행하는 Codex.
기존 Wallet/Dashboard 작업 패키지의 체험 UI 보완이며, 별도 월렛 엔진을 만들지 않는다.
Draft 검토용이다. 병합·배포·사용자 지갑 승인·실제 거래는 수행하지 않았다.

## 기능별 확인 결과와 재사용

1. **대시보드: main에 구현됨.** `dashboard/index.html`, `dashboard.css`, `dashboard-ui.js`의 토큰 현황·장부·토큰 정책 화면을 재사용한다. 이번 변경은 체험 순서 안내, 게임/커뮤니티 섹션만 추가한다. 기존 정책 계산을 변경하지 않는다.
2. **Devnet 잔액: main에 구현됨.** `server.mjs`의 `/api/balances`, `/api/wallet`, `shared.js`, `project-config.js`의 Mint·decimals·genesis 검사와 정수 수량 계산을 재사용한다. 별도 RPC 엔진이나 SDK 의존성을 추가하지 않는다.
3. **지갑 연결: main에 구현됨.** `wallet-connectors.js`, `wallet.js`의 Wallet Standard·Phantom·Solflare 공개 주소 연결과 계정 변경/해제·오래된 응답 무효화를 재사용한다. 지갑 확장이 없어도 프로젝트 공개 현황과 게스트 인터페이스를 체험할 수 있다. main 화면에는 수동 공개 주소 관찰 기능이 없으며 #20의 기존 구현을 기다린다.
4. **거래 내역: main의 Treasury 전용 일부 내역을 재사용한다.** `/api/transfers`는 현재 Treasury 토큰 계정별 최근 20개 서명을 읽고, 합쳐서 최근 20개 거래를 검사한다. 성공한 비영 잔액 변화만 반환한다. 이번 변경은 그 응답에 `status: confirmed`와 화면 상태 표시를 추가한다. 실패·대기·폐쇄 계정·전체 이력은 제공하지 않는다. confirmed는 조회 commitment이며 finalized 보장이 아니다. 개인 지갑 이력은 #20 담당으로 중복 구현하지 않는다.
5. **반응형: 기존 CSS를 재사용한다.** 안내는 760px 이하에서 한 열, 게임/커뮤니티는 기존 800px 이하 한 열 규칙을 사용한다. 실제 모바일·PC 시각 QA는 미완료다.
6. **MONO RUN: 저장소에서 실행 가능한 게임 엔진을 확인하지 못했다.** 이번에는 게스트 세션/결과 계약과 체험 버튼을 제공한다. 샘플 120점/30초는 게임 플레이나 검증된 기록이 아니다. 결과는 메모리에만 유지된다.
7. **Telegram: 기존 구현 재사용 가능.** `scripts/sync-devnet-ledger.mjs`, `notify-telegram-ledger.mjs`, `verify-telegram.mjs`, `.github/workflows/ledger-sync.yml`이 있다. 일일 00:17 UTC(09:17 KST) 예약 및 수동 실행 경로이며 Actions 지연이 가능하다. 이전/현재 장부 서명 차이만 알리고 서버 측 GitHub Secrets가 필요하다. 실제 Secrets/전송 성공 여부는 이번 작업에서 확인하지 않았고 메시지를 보내지 않았다. 프런트엔드에 토큰·chat ID를 전달하지 않는다. 커뮤니티 로그인·게시판·구독·순위표는 미구현이다.

## 기존 PR 의존성과 중복 방지

- [#20](https://github.com/istars8370/shah-cat/pull/20): Wallet 1.0 Devnet UI·관찰 주소·개인 이력. base main, head `76accb296d3e2d200b4457c36ea5b4270a3f66b6`.
- [#22](https://github.com/istars8370/shah-cat/pull/22): 멀티체인 포트폴리오. base #20 브랜치, head `c05d3e1cabf2231900668e7cfc79b02d5055eea5`.
- [#23](https://github.com/istars8370/shah-cat/pull/23): 동일 origin Dashboard/Wallet 연결. base #22 브랜치, head `ee5f9c1b431788bb0fdc21426193ca73f98da437`. #62 변경이 이 브랜치에 포함되어 있다.
- [#67](https://github.com/istars8370/shah-cat/pull/67): EVM 연결 동의 경합 수정. base #23 브랜치, head `e07d2fb7ed4b401216a4bc90d10d6fdb525e1ffb`.
- 위 네 PR은 조회 시점 모두 open/unmerged이며 해당 head의 Dashboard·SDK·Wallet 필수 CI는 성공했다. 특정 브랜치용 missing-ATA live job은 skipped다. 이 증거는 최신 main과 합친 결과의 검증이나 실제 확장 프로그램 QA를 대신하지 않는다.
- [#63](https://github.com/istars8370/shah-cat/pull/63)의 MVP 보안 게이트 계획은 기존 문서로 유지한다. 본 문서는 이번 구현 범위·실행·검증과 게임 계약을 기록한다.

이번 PR은 main을 대상으로 위 월렛 코드를 복사하거나 기존 스택을 병합하지 않는다. `/wallet`, `/api/wallet-history`, 멀티체인 화면·Mainnet 조회는 추가하지 않는다. 따라서 독립적으로 검토할 수 있다. 이후 #20 → #22 → #23 → #67의 base 의존성을 보존하면서 최신 main과 통합할 때 `index.html`, `server.mjs`, `dashboard.css` 충돌을 확인하고 전체 회귀를 다시 실행한다. 병합은 이번 요청 범위 밖이다.

## 실행과 체험

Node.js 20 이상. 런타임 npm 설치가 필요 없다. 이 Draft 브랜치를 체크아웃한 저장소 루트에서:

```powershell
node dashboard/server.mjs
```

브라우저에서 `http://127.0.0.1:4173`을 연다. 포트가 사용 중이면 먼저 `$env:PORT='4187'`을 설정한다. 파일을 직접 열면 모듈/API가 동작하지 않는다. 종료는 터미널에서 Ctrl+C.

1. 상단의 프로젝트 발행량·공개 지갑 잔액·조회 시각을 확인한다. RPC 오류는 화면 안내 후 새로고침으로 재시도한다.
2. 선택적으로 테스트용 확장 지갑을 연결해 공개 주소와 Devnet SOL/SHAH만 확인한다. 앱은 서명·전송을 요청하지 않는다. 이 작업에서는 실제 사용자 확장 지갑에 접근하지 않았다.
3. Treasury 거래 내역 조회를 눌러 성공 상태·금액·Devnet Explorer 링크를 확인한다. 본인의 전체 거래 내역으로 해석하지 않는다.
4. MONO RUN 게스트 세션 시작 → 샘플 결과 확인 → 초기화를 실행한다. 지갑 없이 가능하며 네트워크 요청이나 보상 지급이 없다.
5. 커뮤니티 카드에서 기존 Telegram 설정 문서를 확인한다. 화면에서는 알림 가입/메시지 전송을 하지 않는다.

기존 Treasury 정책 승인 페이지/API는 별도의 메시지 서명 기능을 포함한다. 이번 읽기 전용 체험에는 포함하지 않으며 테스트/사용 대상으로 연결하지 않는다. 기존 서명 없는 전송 사전 점검·수수료 시뮬레이션은 유지되지만 실제 거래를 실행하지 않는다.

## MONO RUN v1 연결 계약

`dashboard/mono-run.mjs`의 `createMonoRunSession(sessionId)`를 실제 게임 어댑터에서 import할 수 있다.

```js
const session = createMonoRunSession(crypto.randomUUID());
// 게임에 전달: version, game, sessionId, mode: guest, rewardsEnabled: false
engine.start(session.context);
// 게임 종료 콜백에서만 호출. 결과는 신뢰하지 않는 클라이언트 데이터다.
const receipt = session.finish({ version: 1, sessionId: session.context.sessionId,
  score: 120, durationMs: 30000 });
// 화면 이탈/재시작 시 session.dispose()
```

`engine`은 후속 게임 구현의 자리이며 이 저장소에는 없다. ID는 영문/숫자/하이픈 1~80자, 점수는 정수 0~1,000,000, 시간은 정수 0~3,600,000ms다. 다른 세션·버전·범위 밖 결과는 거절한다. 정상 결과는 한 번만 소비하고 추가 필드는 복사하지 않는다. 입력/출력은 frozen이며 출력의 `verified`와 `rewardsEnabled`는 항상 false다. 지갑 주소·서명·RPC·토큰 보상·영구 저장 기능을 전달하지 않는다. 향후 외부 iframe 연동 시 별도의 origin/source 및 세션 검증 설계가 필요하다.

## 검증 기록

2026-10-27 로컬 Node v24.22.1에서 실행:

```powershell
node --test dashboard/*.test.mjs
node --test sdk-crosscheck/*.test.mjs
git diff --check
node --check dashboard/mvp-ui.mjs
node --check dashboard/mono-run.mjs
```

- PASS: Dashboard **233/233**, SDK byte parity **4/4**, 실패/스킵 0. 신규 5개 검사는 세션/범위/단일 소비, 네트워크 없는 UI 수명주기, 정적 모듈 allowlist·POST 차단, 실제 localhost HTTP 모듈 그래프를 검증한다. Telegram은 기존 모의 테스트만 실행했다.
- PASS: 기존 `balances()`로 실제 Devnet 읽기. `2026-10-27T04:49:29.496Z`, network devnet, 설정 Mint 일치, supply 1,000,000,000 SHAH, 프로젝트 공개 지갑 2개 조회. 사용자 지갑·서명·발행·전송은 사용하지 않았다.
- 초기 샌드박스 기본 test runner는 자식 프로세스 spawn EPERM으로 실패했다. 이후 권한 검토를 거쳐 동일 기본 명령으로 전부 통과했다. SDK native bigint 바인딩 경고 후 pure JS 경로로 4개 통과; 의존성 보안 해결 증거는 아니다.
- NOT RUN: 실제 Phantom/Solflare·모바일 지갑, 390px 모바일/1440px PC 시각·키보드 QA. Work 설정에서 로컬 브라우저 자동화가 비활성화되어 있다. VM/HTTP 테스트만으로 실제 브라우저 QA를 완료했다고 주장하지 않는다.
- 별도 보안 후속: main의 개발 SDK advisory B-011은 기존 보안 PR(#80 등)의 검토 대상이다. 이번 변경은 의존성·lockfile·보안 게이트를 변경하지 않는다.

## 후속 개발 순서와 완료 기준

1. **현재 초안 QA:** 390px/1440px에서 가로 넘침, 키보드 포커스, 게임 버튼과 상태 안내, RPC 실패/재시도, 연결 취소·계정 전환·해제 시 잔액 초기화를 실제 브라우저에서 확인한다. 테스트용 지갑만 사용하고 서명 요청이 없어야 한다.
2. **기존 월렛 스택 통합:** #20/#22/#23/#67 검토와 최신 main 통합 테스트·확장 QA를 마친 뒤 개인 이력/관찰 모드/동일 origin 연결을 재사용한다. 이번 Devnet 화면에 Mainnet 금액을 합산하지 않는다.
3. **MONO RUN 엔진:** 실제 프로토타입 위치·기술·화면 수명주기를 확정하고 v1 계약으로 시작/종료/재시작을 연결한다. 점수 조작 검증 없는 순위표·토큰 보상은 제공하지 않는다.
4. **커뮤니티:** 기존 Telegram 운영 설정 상태를 담당자가 확인한다. 웹 구독이 필요하면 동의·구독 해제·서버 측 비밀 관리·중복/재시도 정책을 별도로 설계한다. 현재 봇을 프런트엔드에서 호출하지 않는다.
5. **완료 판단:** 새 PR 최종 head CI와 브라우저 QA 기록 후 Devnet 체험 가능 범위를 확정한다. 실제 금융 거래, 토큰 발행, Mainnet 배포, 사용자 자산 접근, Guardian/Falcon 실행 연결은 후속 과제로 자동 승인하지 않는다.

되돌리기: 로컬 서버를 종료하고 main을 별도 체크아웃하면 된다. 이 초안은 체인 상태·장부·사용자 저장소를 변경하지 않는다.
