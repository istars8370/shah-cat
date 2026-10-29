# SHAH CAT P0-01 통합 갱신 기록 — 2026-10-28

기준 main: `9d9734ed98e33d696545f91b5f2c3af9f31ee495`.
이 문서는 [2026-10-27 보고서](P0-01-INTEGRATION-REPORT-20261027.md) 이후 변경분이다.
과거 보고서·PR 및 충돌 JSON은 관측 당시의 원본으로 보존한다.
현재 판단에는 이 갱신 기록과 [새 근거 JSON](p0-01-delta-evidence-20261028.json)을 우선한다.
독립 보안 감사나 인간 승인 문서는 아니다.

## 완료된 통합과 남은 범위

GitHub API와 main을 다시 확인한 결과 다음 변경은 다른 통합 작업에서 이미 수행되었다.
이번 P0-01 갱신 작업이 해당 PR을 병합하거나 GitHub 정책을 변경한 것은 아니다.

- #86 → #80: 추가 SDK 검증과 curve 차이 기록이 부모 브랜치에 통합됨.
- #80 → main `87e5179a8b0568e0f1859e772bb6d7d2c2a8e885`: 현대 SDK 전환·레거시 manifest 폐기.
- #83 → main `5ce739b7bc3d8444787b0ce408c08a9a44469752`: unsigned quote, RPC envelope,
  SPL source 검증과 오류 노출 제한.
- #90 → main `9d9734ed98e33d696545f91b5f2c3af9f31ee495`: unconditional stabilization gate와 운영 상태 정합화.
- B-011은 main의 BLOCKERS에서 유지되는 SDK 검증 경로 기준 **RESOLVED**다.
  개발 의존성 finding이 해결됐다는 뜻이며 외부 감사·Mainnet·custody 안전성 보증은 아니다.
- #69 추적 이슈는 **여전히 OPEN**이다. 문서 해결 상태와 이슈 상태를 구분한다.
  증거를 검토한 사람이 상태를 정리해야 하며 이번 작업에서는 종료하지 않았다.
- all-ff curve 판정 차이 1건은 이미 main의 회귀 테스트와 검토 문서에 남아 있다.
  원본 oracle와 운영 curve 로직은 유지된다. 69개 전부의 curve 동등성을 주장하지 않는다.

main에는 아직 Wallet #89, MVP #81, Guardian #54~#60, Airdrop #91이 통합되지 않았다.
특히 #89는 CI 성공과 실제 확장 지갑 QA 미완료가 동시에 성립한다.

## 정확한 main CI와 보호 규칙

현재 main SHA에 연결된 다음 검사들을 확인했다.

- [Dashboard automated tests](https://github.com/istars8370/shah-cat/actions/runs/40461174075/job/122045894033): SUCCESS.
- [Solana SDK byte equivalence](https://github.com/istars8370/shah-cat/actions/runs/40461174075/job/122045893608): SUCCESS.
- [Stabilization security gate](https://github.com/istars8370/shah-cat/actions/runs/40461174047/job/122045895444): SUCCESS.
- [offline-security](https://github.com/istars8370/shah-cat/actions/runs/40461174126/job/122045894022): SUCCESS.
- [audit](https://github.com/istars8370/shah-cat/actions/runs/40461174015/job/122045893240): SUCCESS.
- Devnet missing-ATA live simulation: SKIPPED. 실제 Devnet 실행 증거로 세지 않는다.

[활성 ruleset 25586369](https://github.com/istars8370/shah-cat/rules/25586369)를 API로 다시 읽었다.
필수 check는 Dashboard automated tests, Solana SDK byte equivalence, Stabilization security gate의 세 개다.
최신 base 필수, 승인 리뷰 1개, 새 push의 마지막 변경 승인, stale review 무효화,
리뷰 thread 해결이 요구된다. main 삭제·non-fast-forward 방지와 bypass actor 0도 유지된다.
고전 branch protection의 축약 표시 대신 실제 ruleset을 근거로 판단했다.

과거 보고서의 'Dashboard만 필수 / 승인 수 0 / main audit FAIL'은 과거 checkpoint이며 현재 상태가 아니다.
B-013 문구에도 follow-up 표현이 남아 있지만, 위 정책과 check 적용은 현재 API로 확인된다.
이번 작업은 운영 상태에 대한 검증만 수행했고 관리자 설정을 변경하지 않았다.

## 열린 PR과 우선순위 변경

열린 PR은 **33개**다. 이번에는 기존 #82도 포함한다.
과거 최초 27개 목록은 #82 생성 전 기준이므로 숫자를 그대로 비교해 성과를 계산하지 않는다.
모든 현재 번호·head SHA·base·Draft 상태는 새 JSON에 기록한다.
전체 과거 PR의 코드 검토와 모든 check를 다시 수행한 것은 아니다.

기존 세 작업 묶음을 유지하고 새 병렬 작업이나 담당자를 배정하지 않는다.

1. **통합·운영 근거:** 이 #82 갱신을 검토한다. #65·#66은 현행 NOW와 상태 차이가 있어
   그대로 운영 지침으로 병합하지 않는다. #63·#84·#85·#88의 문서는 최신 구현·검증과 맞춰야 한다.
   특히 #88 본문의 '#80 미병합' 전제는 오래되었다.
2. **Wallet/Dashboard:** 최신 main 기반 **#89**를 현재 후보로 검토한다.
   원래 #20→#22→#23→#67 및 #87은 출처를 보존한다.
   #89는 main을 정확히 포함하며 새로 main에 적용되지 않은 변경 경로는 wallet-v1와 전용 회귀 workflow다.
   낡은 #23 Dashboard 파일을 현재 main 위에 다시 덮어쓰지 않는다.
3. **보안 검증 유지:** 세 필수 check와 현대 SDK 감사가 새 head에서도 실행되는지 확인한다.
   과거 보안 실험 #70~#79의 보관·대체 판단은 #88 내용과 최종 파일 트리를 확인한 뒤 사람이 결정한다.

#80이 squash되어 main으로 들어왔으므로 실험 head가 main의 raw ancestor인지 여부만으로
종료를 판단하면 안 된다. 부모 #80 이력 포함과 main의 최종 내용 보존은 다른 질문이다.
#70의 audit JSON/artifact 기능과 #71의 독립 실험은 자동으로 중복 처리하지 않는다.
이번에는 PR 종료·branch 삭제·retarget을 실행하지 않았다.

### Wallet #89의 실제 판정

head: `fd40a73411f1267c8663cef80c5aa76ae0758b2a`, base main, Draft 유지.
Dashboard, SDK, Stabilization, offline-security, wallet-read-only가 해당 head에서 모두 SUCCESS다.
인간 제출 리뷰는 조회 시점 0건이다.

원래 작성자의 기록에는 475개 결합 테스트, 네 체인의 실제 공개 주소 읽기,
IAB Ethereum 화면·유효하지 않은 입력·provider 없음·send 비활성이 있다.
이 P0-01 갱신에서 다시 실행한 실지갑/브라우저 QA로 표현하지 않는다.

**HOLD:** 설치된 Phantom/EVM 확장의 승인·거절·계정 전환과 독립 Explorer 비교가 미완료다.
IAB에 확장이 없거나 Explorer가 403인 것을 성공으로 간주하지 않는다.
실제 서명·전송이 필요한 증거로 범위를 넓히지 않는다.
#81의 최신 MVP 변경은 별도 검토 후 #89와 화면 동선·상태 분리를 확인해야 한다.

### 새 Airdrop #91

head: `5f5a59bd4f7eb068e93a11a4413fbfdaf089d031`.
기존 main 기준 21파일의 로컬 신청·심사·장부·관리자 인증·Treasury 제안 export 기능이 추가된 후보다.
제안 본문은 서명·전송·자동 Treasury 이동이 없고 localhost 범위라고 명시한다.
그 서술만으로 전체 안전성을 인증하지 않는다. 이번에는 변경 목록과 범위만 조사했다.

Dashboard index/server/ci-smoke를 건드리므로 #81 및 기존 Dashboard 통합과 변경 의도를 조정해야 한다.
인증·공개 배포·개인정보·캠페인 한도·운영 부하·실제 승인된 예산에 대한 별도 검토가 필요하다.
본 작업에서는 관리자 토큰 확인·수집, 서비스 기동·신청·심사·제안 export·지급·배포를 하지 않았다.
기존 세 작업 묶음을 넘는 추가 실행이나 public launch는 시작하지 않는다.

Guardian #54~#60은 계속 연구 후속이다. host Cargo와 배포 runtime 증거를 구분하고,
D0 읽기 전용과 D1 실제 실행을 혼동하지 않는다. Falcon/custody/Mainnet은 계속 HOLD다.

## 이번 안전한 수정과 검증

기존 보고서 브랜치 `codex/p0-01-integration-audit-20261027`에 최신 main을 동기화했다.
main ref나 기존 제품 PR을 병합한 것이 아니다. 충돌 없이 동기화했고 force push는 하지 않는다.
동기화 후 **현재 main과 비교한 제품 코드·workflow·manifest·fixture diff는 없다**.

PR #82 전체 변경은 문서·근거 다섯 파일이다.

- 2026-10-27 보고서: 역사적 checkpoint임과 새 보고서 링크를 맨 위에 표시.
- 2026-10-27 evidence JSON과 conflicts JSON: 원본 그대로 보존.
- 이 2026-10-28 갱신 기록: 병합 완료·CI·보호 규칙·남은 우선순위와 승인 사항.
- 새 delta evidence JSON: 33개 PR, main/Wallet checks, ruleset, 이슈 상태와 로컬 결과.

로컬 Node 24.22.1 / npm 11.19.1에서 최신 main 조합으로 새로 실행했다.

- PASS: Dashboard+Four-Way **428/428**, FAIL 0, SKIP 0.
- PASS: guarded offline security **249/249**, FAIL 0, SKIP 0.
- PASS: modern SDK **13/13**, FAIL 0, SKIP 0.
- PASS: 전체 개발 의존성 포함 현대 lockfile npm audit — **0 vulnerabilities**.
- PASS: 구문·JSON/33개 번호 고유성·보고서 링크·diff whitespace·현재 main과 제품 코드 동일성.
- PASS: tracked 파일 heuristic secret scan — finding 0. entropy/BIP39·비추적 파일·외부 로그의 부재 보증은 아니다.

세 테스트 묶음은 서로 겹치므로 합산하지 않는다. Node 22의 새 원격 CI는 #82 갱신 후 확인한다.
이번 작업은 mock/localhost 검증만 수행했다. 실제 RPC·설치 확장·Explorer·Wallet #89의
475개 결합 suite·Guardian Cargo/SBF·배포·Airdrop 실행은 **NOT RUN**이다.

## 인간 승인과 다음 실행 기준

- #82 최신 보고서와 PR의 실제 병합. 이 채팅의 기존 '자동 병합 금지'는 유지한다.
- #69와 B-013 문서/상태 정리, 실험 PR의 내용 기반 대체·종료. 자동 종료하지 않는다.
- Wallet #89의 실제 확장/Explorer QA와 인간 코드 리뷰. QA 미완료 상태에서 Ready로 격상하지 않는다.
- #81과 #91의 UI/API 변경 범위, 새로운 공개 운영·예산·개인정보 검토는 별도 결정한다.
- Guardian/Falcon 권한, custody, Treasury 자금, 실제 서명·전송·Mainnet/배포는 계속 승인되지 않았다.

main이나 PR head가 바뀌면 이전 성공을 새 head로 옮겨 적지 않는다.
충돌·필수 check 실패·누락된 고유 내용·예상 밖 fixture/runtime 변경이 나오면 해당 통합을 중단한다.
