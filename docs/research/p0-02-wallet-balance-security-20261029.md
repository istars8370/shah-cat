# P0-02 연결 지갑 잔액 검증 후속 결과

2026-10-29 KST. 기준 main: `9d9734ed98e33d696545f91b5f2c3af9f31ee495`.
브랜치: `codex/p0-02-wallet-balance-20261029`.

## 최신 상태 및 범위

기존 #83은 main `5ce739b7bc3d8444787b0ce408c08a9a44469752`에 병합됐다.
SDK 의존성 수정 #80은 main `87e5179a8b0568e0f1859e772bb6d7d2c2a8e885`에
병합됐고, 현재 BLOCKERS는 유지되는 modern SDK 검증 경로의 B-011을 RESOLVED로 분류한다.
10월 27일 보고서의 High 3/Moderate 6 항목은 당시 legacy 도구의 역사적 결과이며
현재 maintained graph의 결과로 재사용하지 않는다. 이번 작업은 dependency/lockfile을 변경하지 않는다.

PR #60 head `5427caa5cd9ce60031ec8ec78f4c0f563250ba59`는 여전히 Draft/open 설계다.
D1 runner/전체 M01–M24 실행과 실제 전송은 이 작업의 대상이 아니다.
기존 P0-02의 잔액 검증 후속으로 진행했으며, Wallet #89의 설치 확장 프로그램 QA나
다른 담당자의 D1/Guardian 구현을 중복 수행하지 않는다.

최초 검사는 읽기 전용 소스 점검과 기존 오프라인 suite(249 PASS)였다.
이후 합성 공개 주소와 주입된 fake RPC로만 테스트했다. 실제 RPC·Faucet·확장 지갑 연결·키 생성·
서명·전송·Treasury 접근·Mainnet·배포·병합은 수행하지 않았다.
GitHub 조회와 PR/브랜치 게시는 코드 협업 작업이며 체인 접근과 구분한다.

## 문제와 수정

기존 `walletBalance`는 RPC의 mint filter를 신뢰하고 각 entry의 decimals/raw amount만 더했다.
응답의 outer program owner, parsed account type, token mint/holder/state 및 계정 주소를 확인하지 않아
다른 토큰이나 잘못된 holder의 잔액을 SHAH 잔액으로 표시할 수 있었다.
중복 pubkey도 두 번 합산했다. 이는 지갑 화면의 잔액 무결성 문제이며 실제 탈취를 입증하지 않는다.

- 지갑 전용 집계 helper는 value 배열, canonical legacy Token Program,
  parsed.type=account, 정확한 mint와 조회 주소에 해당하는 holder, initialized/frozen state,
  유효한 32-byte 계정 주소 및 계정 주소 고유성을 요구한다.
- 잘못된 계정 하나라도 있으면 전체 snapshot을 거부한다. 충분한 정상 계정이 먼저 있어도
  잘못된 sibling을 숨기지 않는다. Token-2022·누락 필드도 거부한다.
- 기존 uint64 BigInt 및 decimals 검증을 유지한다. 여러 계정의 최소 단위도 보존한다.
  initialized/frozen은 보유량 집계에 포함되며 spendability는 별도 preflight/quote가 판단한다.
- 반환 직전 genesis를 재확인하여 조회 중 cluster 변경을 거부한다.
- `/api/wallet`의 실패는 502 고정 오류이며 부분 SOL/SHAH 잔액을 노출하지 않는다.
  운영 지갑/status 및 Treasury 집계 helper/endpoint는 수정·실행하지 않았다.

기존 server 테스트 helper에는 실제 jsonParsed 응답의 owner/type/mint/holder/state/pubkey를
추가하고 두 토큰 계정의 주소를 서로 다르게 명시했다. 실제 네트워크 접근은 없다.

## 재현 및 검증

로컬 Node v24.22.1, Windows PowerShell. 오프라인 tripwire를 사용했다.

수정 전 신규 파일: **26개 중 5 PASS / 21 FAIL**.
그중 17개는 잘못된 성공/중복 합산/cluster 변경/API 성공의 거부 assertion이 실패한 것이고,
4개는 잘못된 목록이 이미 TypeError로 실패했지만 정해진 검증 오류가 없었던 경우다.
[수정 전 증거](p0-02-evidence/wallet-balance-before-20261029.tap).

수정 후 전체 curated suite: **275 PASS / 0 FAIL / 0 SKIP**.
[수정 후 증거](p0-02-evidence/wallet-balance-after-20261029.tap).
기존 server 선택 회귀: **4 PASS / 0 FAIL**.
[server 증거](p0-02-evidence/wallet-balance-server-20261029.tap).
두 suite의 수는 합산한 총 테스트 수로 보고하지 않는다.

```powershell
node --test --test-reporter=tap --experimental-test-isolation=none scripts/run-offline-security.mjs
node --test --test-reporter=tap --experimental-test-isolation=none --require ./scripts/offline-security-guard.cjs --test-name-pattern="wallet aggregates|mismatched token precision|malformed addresses|HTTP routes reject" dashboard/server.test.mjs
```

수정 전 재현은 기준 main 소스에 신규 `dashboard/wallet-balance-security.test.mjs`만 적용한 뒤
동일 preload 및 isolation 옵션으로 해당 파일을 실행한다. 예상 실패/통과 수는 위와 같다.
Windows 기본 자식 프로세스 제한 때문에 로컬은 isolation=none을 사용하며 CI는 Node 22다.
새 파일은 기존 Dashboard 자동 검색과 guarded offline runner 양쪽에 포함된다.
최신 head CI 결과는 Draft PR 본문에 별도 기록한다. 이전 main/PR의 성공은 이번 head의 증거가 아니다.

추적 파일 heuristic 비밀정보 검사는 값 출력 없이 수행하며 결과는
[secret scan](p0-02-evidence/wallet-balance-secrets-20261029.json)에 기록한다.
BIP39/entropy·외부 logs/artifacts·ignored/untracked 파일 전체 검사를 의미하지 않는다.
로컬 npm install/audit 및 실제 Solana SDK 실행은 하지 않았다. 최신 maintained graph의 설치·감사는
새 head의 기존 CI stabilization gate 결과와 구분해 보고한다.

## 남은 한계

동일 RPC가 genesis와 계정 데이터를 함께 위조하는 경우의 정직성은 검증하지 못한다.
confirmed 조회 사이의 slot 원자성이나 향후 잔액/전송 성공도 보장하지 않는다.
실제 확장 지갑 동의, Wallet #89 수동 QA, D1 runner/실행, 외부 독립 감사,
Guardian/Falcon/custody 및 Mainnet 준비 상태는 이 mock 결과로 입증되지 않는다.
실제 작업의 승인 경계는 그대로 유지한다.
