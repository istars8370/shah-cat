# SHAH CAT P0-01 저장소 통합 및 정리 보고서

관측일: 2026-10-27 KST. 대상: [istars8370/shah-cat](https://github.com/istars8370/shah-cat).
기준 main: `fab83762da8aed49bfc7983136526643dc0827a6` (#68 병합 커밋).
최종 목록 재조회에서 신규 #81을 추가 반영했다. 최초 26개 → 최종 27개이며 이번 보고서 Draft는 제외한다.
GitHub 수집 시작: 2026-10-27 04:48:14 UTC. 변경 가능한 PR 정보는 이 시점의 스냅샷이며 병합 직전에 다시 확인해야 한다.
상태: **분석 완료 / 문서·근거만 추가 / 통합·삭제·배포 실행 없음 / 인간 리뷰 필요**.

## 1. 판단 요약

- 열린 PR 전부 **27개**를 조사했다. API 첫 페이지 100개 한도에 27개가 반환되어 추가 페이지가 필요하지 않았다. 새로 만드는 이 보고서 PR은 이 숫자에서 제외한다.
- 일반 CI 성공과 보안 감사 실패가 동시에 존재한다. main의 B-011은 해결되지 않았다. #80의 감사 성공을 main의 성공으로 옮겨 쓰면 안 된다.
- #65 → #66은 운영 문서 체인이다. #80과 코드 의존성이 없으며, #65·#66을 먼저 병합해야 #80을 검토할 수 있는 관계도 아니다.
- 보안 후보는 #80 한 곳으로 모으는 것이 안전하다. #72~#79의 현재 head가 #80의 조상임을 확인했으나, #70·#71은 조상이 아니다. 내용 기반 대체 판단과 사람의 승인이 필요하다.
- Wallet 통합 #23·#67은 각자의 base에서는 clean이지만 현재 main과는 실제 텍스트 충돌이 있다. 단순한 PR 번호순 병합으로 해결되지 않는다.
- main 기반 오프라인 Dashboard/Four-Way **379개 통과, 실패 0, skip 0**. 별도 SDK 설치, 실제 지갑 확장 QA, 실제 네트워크 전송, Guardian 배포는 이 결과에 포함되지 않는다.
- 새로운 기능·실험을 추가하지 않는다. 기존 NOW의 세 작업 묶음(보안, Guardian/Devnet, Wallet)을 유지하며 이번 문서는 통합 조정 범위에 속한다.

## 2. 조사 근거와 범위

[PR 목록 스냅샷](p0-01-evidence-20261027.json)은 모든 열린 PR의 정확한 head/base SHA, 제목, Draft 상태, 변경 파일, check 결과와 원본 본문을 보관한다.
[충돌 검사 결과](p0-01-conflicts-20261027.json)는 27개 head 대 main의 merge-tree, 주요 교차 병합 14쌍, 정확한 head 포함 관계 및 변경 경로 중복을 보관한다.

수집한 PR detail의 mergeable은 해당 PR의 target 기준이다. 별도의 `git merge-tree --write-tree`로 실제 main 통합 충돌을 검사했다. 이 명령은 임시 Git 객체를 만들 수 있지만 작업 트리·index·branch ref를 바꾸지 않는다. 텍스트 충돌이 없다는 사실만으로 행동·보안 호환성을 보장하지 않는다.

로컬 원래 작업 폴더는 `feature/phantom-wallet-connect`에 여러 미커밋 변경과 다른 작업 복제본이 있어 보존했다. 별도 `shah-cat-p0-01` 체크아웃에서 main 기준 `codex/p0-01-integration-audit-20261027` 브랜치를 만들었다. 프로젝트 AGENTS, docs/ops/AGENTS, NOW, BLOCKERS를 먼저 읽었다. 기존 문서의 과거 승인 서술을 이번 작업의 병합·삭제 승인으로 해석하지 않았다.

전체 저장소 보안 인증이나 독립 외부 감사는 수행하지 않았다. 비밀값·지갑 파일을 찾거나 출력하지 않았고, Telegram/ledger workflow를 수동 실행하지 않았다.

## 3. 완료·구현·미완성 구분

### main에 통합된 범위

- Dashboard 2.0, 공개 주소/잔액 조회, Devnet genesis·mint 검증, 수수료/ATA 확인과 미서명 simulation 코드가 존재한다.
- tokenomics v0.6 문서·정책 표시, Treasury 요청·승인 기록 모듈이 존재한다. Treasury UI에는 기존 `signMessage` 경로가 있으므로 저장소 전체가 '서명 코드가 없다'고 주장할 수 없다. 이 작업에서는 호출하지 않았다. 오프체인 메시지 승인은 온체인 다중서명·자금 이동 증거가 아니다.
- 운영 #52, 연구 정합화 #53, 연구 통합 #50, CI 개선 #68이 main에 포함된다. #52·#53·#50 head에 대한 ancestor 검사도 성공했다.
- Four-Way는 `research/four-way`의 JS 연구 모델과 테스트·위협 모델이다. Guardian 온체인 배포나 Falcon 권한 계층 완료를 의미하지 않는다.

### PR에만 구현된 범위

- #20·#22·#23·#67: 독립 Wallet, 멀티체인 공개 잔액, Dashboard 결합, EVM 동의 경쟁 조건 수정. main에는 아직 없다. #62는 #23에만 정확한 head가 포함되어 있다.
- #54~#58: G1 state, G2 설계·안정 PDA·인증 복구·replay/timing 테스트. main 미포함 연구 코드다.
- #59: D0 읽기 전용 네트워크 증거 생성. #60: D1 SOL 실험 설계 문서만 존재한다.
- #80: 현대 SDK 검증기·레거시 npm manifest 폐기·guard. main 미병합이며 B-011 해결 후보 상태다.
- #26: 서명 준비 코드와 실패하는 테스트. 완료로 분류하지 않는다.

- #81: 조사 도중 추가된 P0-03 Devnet 체험 UI·MONO RUN 게스트 계약 초안. main 기반 별도 Draft이며 실행 가능한 게임·보상 서비스는 아니다. 신규 의존성은 없다.

### 미완성·보류

실제 확장 Wallet QA, 최종 통합 SHA의 회귀 테스트, Guardian SBF/프로그램 런타임 검증, Falcon/FN-DSA 호환 벡터·재현 빌드·자원 측정, 독립 외부 감사가 남았다. 실제 D1 전송·custody·Treasury 자금 이동·Mainnet·프로덕션 릴리스는 승인되지 않았다.
`FALCON_COMPATIBILITY_MATRIX.md`의 PASS는 별도 `research/pqc-falcon` 브랜치의 과거 검사 출처를 가진다. 그 경로가 현재 main에 배포되었다는 의미가 아니다.

## 4. 핵심 PR #65·#66·#80

### #65 운영 프로토콜

[PR #65](https://github.com/istars8370/shah-cat/pull/65), head `4e56473d546ec6d6838d2c5717e4e550a12bef6c`, Draft, main 대상.
변경은 COMMAND_CENTER_2.md와 INTEGRATION_DECISION_65_53.md 두 문서다. Dashboard/SDK check 성공, 인간 제출 리뷰 0건이다.

COMMAND_CENTER_2는 #52를 아직 제안으로 다루고 Gemini를 활성 협업자로 가정하며, 초기 큐는 이미 병합된 #53 검토를 요청한다. INTEGRATION_DECISION_65_53은 과거 SHA·미병합 전제를 기록한다. 반면 main의 AGENTS/NOW는 Gemini 중지, #52·#53 통합, 현재 세 작업 묶음을 규정한다.

권고: 기존 NOW를 활성 큐로 유지하고 #65의 유효한 리뷰·증거·롤백 규칙만 맞춰 반영한다. 과거 스냅샷을 현재 지시문처럼 병합하지 않는다. #52 문서를 또 다른 권위 원천으로 복제하지 않는다.

### #66 과거 PR 분류

[PR #66](https://github.com/istars8370/shah-cat/pull/66), head `23870b9255d7a0a876ee84c9018c156612989a10`, Draft, #65 브랜치 대상.
PR_TRIAGE_2026-10-27.md 한 파일, Dashboard/SDK 성공, 인간 제출 리뷰 0건이다.

40개 PR 스냅샷은 현재 27개 목록과 다르며 #52·#53·#62 및 #27~#50의 상태, Gemini 배정이 오래되었다. #65의 현재 head는 #66 head의 조상이 아니다. #66 이후 #65에 `28af297`, `4e56473` 두 커밋이 추가되었다.

권고: #65 내용을 정리한 다음 #66을 부모 최신 내용과 동기화하고 분류를 재작성한다. 이번 보고서는 최신 판단 근거를 제공하지만 #66을 자동 종료하거나 대체 확정하지 않는다. 과거 기록을 보존할지는 인간이 결정한다.

### #80 B-011 보안 통합 후보

[PR #80](https://github.com/istars8370/shah-cat/pull/80), head `e77602463a19ef7f06acaf4528cf082679b41a91`, main 포함, **GitHub Draft=false**.
본문·내부 문서는 DRAFT라고 표현하지만 API 상태는 Ready다. 인간 제출 리뷰 0건이다.

실제 net diff는 **12파일**, main 대비 head-only **48커밋**이다. 본문의 11파일과 내부 리뷰 문서의 `0e92c11...` SHA는 현재 상태와 다르다. 변경 파일 전체는 증거 JSON에 기록했다.
대시보드·scripts·research 및 동결 fixture에 대한 net diff는 없다.

- `tools/sdk-modern`: kit 6.10.0, token 0.10.0 고정 package/lockfile, verifier, README 추가.
- 주 CI와 dependency guard를 현대 SDK로 전환.
- sdk-crosscheck와 tools/sdk-reference의 package.json·package-lock.json 총 4개를 제거하는 제안. 역사적 generator/test 소스와 동결 JSON은 유지된다.
- 감사 job 로그에서 **0 vulnerabilities**, 현대 verifier **3/3** 통과를 확인했다. 38 ATA, 6 legacy message/wire, instruction program/account role/data, amount/destination/program negative control을 검사한다.
- Dashboard의 sdk-reference 테스트는 runtime 결과와 동일한 동결 oracle를 비교한다. 현대 verifier와 함께 간접 동등성 근거를 제공한다. 이전 crosscheck의 입력 조합과 완전히 동일한 모든 경로를 재실행하는 것은 아니며 Token-2022·multisig·실제 signing까지 보장하지 않는다.
- `sdk-crosscheck/sdk-equivalence.test.mjs`는 소스만 남아 정상 설치 경로가 사라진다. 이 디렉터리에도 명확한 보관 안내를 추가할지 #80 리뷰에서 결정할 필요가 있다. 현대 verifier로 oracle 자체를 재생성해서는 안 된다.
- 최종 workflow 파일 트리에는 b011-* 실험·자체 push workflow가 없다. 그러나 48커밋 이력에는 실험이 포함된다. 승인 시 **#80만 squash**하는 방안을 권고하고 #72~#79를 중복 병합하지 않는다.
- 이번 P0-01은 #80의 삭제 제안을 실행·복사하지 않는다. source/consumer·lock provenance·coverage를 인간이 검토하고, 승인 후 main 감사 결과까지 확인한 다음 #69/B-011 종료를 판단한다.

## 5. CI·보안 상태

### main의 실제 check

- [SHAH CAT CI 40430528884](https://github.com/istars8370/shah-cat/actions/runs/40430528884): SUCCESS.
- [Four-Way 40430528969](https://github.com/istars8370/shah-cat/actions/runs/40430528969): SUCCESS.
- [SDK guard 40430529026](https://github.com/istars8370/shah-cat/actions/runs/40430529026): FAIL, 두 SDK 도구의 audit step 실패.
- 각 도구의 로그는 **3 high + 6 moderate 영향을 받은 패키지 항목**, 고유 GHSA는 두 도구 합집합 **5개**다. 18개 독립 취약점으로 세면 안 된다.

직접 확인한 GHSA:
- bigint-buffer high: [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg).
- stream-json moderate: [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x), [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x), [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc).
- uuid moderate: [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

레거시 의존성은 개발·참조 도구에 있다. Dashboard 운영 프로세스가 이 체인을 import한다는 증거는 이번 조사에서 없다. 이 사실은 모든 런타임 취약점이 없다는 보증도 아니다. 두 도구는 spl-token 0.4.15를 중복 설치하고 web3.js는 1.99.0 / 1.98.4로 다르다. 참조 생성기와 runtime crosscheck라는 목적 차이는 있으므로 단순 중복 패키지라고 임의 제거하지 않는다.

### PR별 주의점

- #80 현재 head에 연결된 [CI 40439763601](https://github.com/istars8370/shah-cat/actions/runs/40439763601)와 [guard 40439763720](https://github.com/istars8370/shah-cat/actions/runs/40439763720)는 SUCCESS. 실제 CI checkout은 main과의 임시 merge commit `a3179884498ae571fc897b49bca79b10dfece39f`였다.
- #70은 audit 두 개 실패. 원래 취약점을 그대로 드러내는 결과이며 성공으로 바꾸기 위해 severity를 낮추면 안 된다.
- #72·#76은 현재 head의 check-run 목록이 비어 있다. workflow runs를 추가 확인하니 각각 **action_required**다. 통과도 기능 테스트 실패도 아닌 실행 승인 대기로 기록한다.
- #26 [실패 job](https://github.com/istars8370/shah-cat/actions/runs/40143748721/job/121020662462): 231개 중 230 PASS, 1 FAIL. `transfer-quote.test.mjs:242` 상한 검증에서 예상 /1,000 SHAH/ 대신 'No single initialized SHAH token account has enough balance'가 발생한다. 테스트 잔액과 검증 순서를 별도 검토해야 하며 본 작업에서 안전성 로직을 바꾸지 않았다.
- Guardian CI의 unit-tests는 `cargo test` host 검사다. SBF build/program-test/local validator/배포 실행 성공으로 확장 해석하지 않는다.
- Devnet missing-ATA probe는 특정 과거 head_ref 조건으로 제한되어 대부분 SKIPPED다. D0/Four-Way는 paths 조건 때문에 모든 PR마다 실행되지 않는다. 생략은 성공한 실제 Devnet 실행이 아니다.

### 저장소 보호와 자동화

[활성 ruleset 25586369](https://github.com/istars8370/shah-cat/rules/25586369)를 확인했다. main 삭제·force push 방지와 PR 요구, 최신 base에 대한 Dashboard automated tests만 필수다. 요구 승인 수는 **0**, SDK guard/Four-Way/Cargo/Wallet은 필수 check 목록에 없다. 따라서 GitHub의 green/clean이 본 작업의 인간 승인 요건을 대신하지 못한다.
고전 branch-protection 상세 API는 connector 권한으로 403이었으나 ruleset 상세는 읽었다. 보호가 없다고 단정하지 않았다.

검토 제안: 안정적으로 항상 실행될 보안·회귀 check를 정한 다음 required checks와 인간 승인 수를 강화한다. paths로 skip되는 workflow를 무작정 필수로 지정하면 PR을 영구 대기시킬 수 있으므로 정책 변경은 별도 승인 사항이다.

main에는 ledger-sync의 contents:write, 자동 데이터 브랜치 force push, Telegram 알림이 존재한다. #72에는 후보 브랜치에 lockfile을 자체 push하는 실험 workflow가 있다. 이번에는 읽기만 했고 실행하거나 설정을 변경하지 않았다. Actions SHA pinning·자동화 권한 최소화도 별도 검토 대상으로 남긴다.

## 6. 실제 충돌·의존성·병합 순서

### 확인한 관계

- 운영: main → **#65 → #66**. 최신 #65 head 미포함이므로 #66 재동기화 필요.
- Wallet: main → **#20 → #22 → #23 → #67**. #20→#22, #22→#23 정확한 head 포함 확인. #23의 최신 head는 #67에 미포함이다. #23에는 #62 head가 포함된다.
- Guardian: 이미 병합된 #50/#53 → **#54 → #55 → #56 → #57 → #58 → #59 → #60**. 해당 PR head 간 포함 관계 확인. 현재 main을 포함하지 않으므로 먼저 동기화하고 단계별 검증한다.
- 보안 실험: main → #72 → #73 → #74 → #75 → #76 → #77 → #78 → #79. 이 전체 현재 head가 #80에 포함된다. **#80은 main 직접 대상의 최종 파일 트리 후보**다. #70·#71은 독립이고 조상 미포함.
- #63과 #26은 각각 main 대상의 독립 제안이다. #63은 문서 중복 조정, #26은 실패/서명 경계로 HOLD한다.

- #81은 main 기반 독립 UI 보완이며 #20~#67의 Wallet 엔진을 복제하지 않는다. 그러나 index.html/server.mjs/dashboard.css가 #23과 겹치므로 기존 Wallet 작업 묶음 안에서 순서를 조정한다.

### 실제 충돌

27개를 현재 main과 검사했을 때 **#23·#67만 텍스트 충돌**, 나머지 25개는 텍스트 병합 가능이었다. #23/#67의 충돌 파일:
- `dashboard/dashboard-ui.js`
- `dashboard/index.html`
- `dashboard/server.mjs`

각 Wallet PR의 CI가 성공해도 현재 main의 tokenomics·Treasury·UI 변경을 보존한 최종 결합을 검증한 것은 아니다. 기존 파일 전체를 어느 한쪽으로 선택하는 방식의 충돌 해결은 금지하고 변경 의도를 수동 대조해야 한다.

#80 + #70은 `.github/workflows/dependency-guard.yml` 내용 충돌. #80 + #23, #23 + #26은 위 Dashboard 3파일 충돌. #65 + #66, #80 + #20/#60/#72/#79, #20 + #26, #23 + #67은 텍스트 병합 가능이었다.
#81 + #23 및 #81 + #67도 동일한 Dashboard 3파일 충돌이다. #81 + #80, #81 + #20은 텍스트 병합 가능했다. CSS 변경 경로는 중복되지만 검사한 조합에서 CSS 내용 충돌은 없었다.
#80 이후 #72의 raw history 병합이 텍스트상 가능해도 필요하거나 안전하다는 뜻은 아니다. squash 후에는 커밋 조상 관계가 달라지므로 적용 diff와 새 SHA로 대체 근거를 다시 남겨야 한다.

### 권고 실행 순서와 중단 조건

1. 이 문서·근거 Draft를 인간이 검토한다. 원래 작업 트리와 모든 기존 브랜치를 유지한다.
2. 기존 보안 작업 묶음에서 #80의 Ready/Draft 불일치, 12파일·현재 SHA, 보관 소스 안내를 정리한다. 새 SHA가 생기면 CI·full audit·parity를 다시 확인한다. 기존 알려진 finding을 숨기거나 oracle를 재생성하면 중단한다.
3. 사람이 #80의 net diff와 의존성 출처를 승인한 경우에만 #80 한 건의 squash 병합을 고려한다. main에서 audit·Dashboard·SDK·관련 research를 확인하고 #69/B-011 상태를 재판단한다. 이번 작업은 이 단계 실행을 승인하지 않는다.
4. #70~#79의 고유 내용과 최종 patch를 기록한다. #70 artifact 보존 기능이 여전히 필요한지 별도 결정한다. 사람의 대체/보관 승인 뒤에만 PR 종료를 고려하며 소스 브랜치는 보존한다.
5. #65의 유효 규칙을 현행 AGENTS/NOW에 맞춰 정리하고 #66 부모를 갱신한다. #63은 RELEASE_GATES와 겹치는 범위를 정리한다. 운영 문서 갱신이 보안 검토를 기술적으로 차단하지 않는다.
6. Guardian 작업 묶음: 최신 main에 #54부터 순차 갱신·검토한다. 각 단계 후 cargo test, 상태 v1→v2 레이아웃/PDA 불변식·복구 권한·nonce/timing 검증을 수행한다. SBF/program runtime 증거가 없으면 연구 구현 이상으로 격상하지 않는다. #59 D0 읽기 전용 재검증과 #60 설계 승인은 실제 D1 전송 승인과 분리한다.
7. Wallet 작업 묶음: #81 UI 보완은 이 작업 묶음 안에서 검토한다. 현재 main 기반이고 #80과 텍스트 충돌이 없어 UI QA 완료 후 먼저 병합할 수 있지만, 이후 Wallet 최종 조합에서 게임 섹션·status 표시·정적 모듈 경로를 보존해야 한다. 또는 Wallet 통합 후 최신 main에 다시 적용한다. 두 방식을 동시에 진행하지 않고 한 담당자가 파일 범위를 관리한다.
   기존 Wallet 체인은 #20 → #22 → #23 → #67 순서로 갱신한다. main의 3파일 충돌을 수동 해결하고 #62·#67 둘 다 보존한다. 현대 SDK CI와 Wallet regression job이 함께 남는지 검토한다. 최종 Dashboard+Wallet+SDK 테스트, 브라우저 탐색, 네트워크별 잔액 분리, 실제 확장 공개계정 동의 QA를 마친 뒤 인간이 병합을 판단한다.
8. #26은 별도 작업으로 실패를 재현하고 서명 준비 endpoint의 권한·UX·수량 상한을 검토할 때까지 HOLD. Mainnet·전송·지갑 서명·배포는 계속 금지한다.

각 단계에서 main이나 대상 head가 달라지면 이전 green 상태를 재사용하지 않고 정확한 새 SHA로 판정한다. 승인·CI 실패·예상 밖 fixture/runtime 변경·알려지지 않은 고유 변경 발견 시 해당 통합을 중단한다. 작업 전 base, 승인된 diff, 테스트를 보관하고 사고 시 별도 revert PR을 제안한다. main reset/force push, branch 삭제는 하지 않는다.

## 7. 실험·중복 정리 후보

- #71의 transitive override probe, #73 bigint exposure, #74 token isolation, #75 ATA/byte probe, #76 candidate, #78 retirement inventory는 탐색 산출물이다. 정상 CI에 모두 쌓아 같은 SDK 설치·테스트를 반복할 필요가 없다. #80 최종 트리에서 제외된 상태를 유지하는 방안이 적절하다.
- #72의 자동 lockfile push는 조사 단계용이다. 승인 후 정상 lockfile 업데이트를 대신하는 상시 workflow로 채택하지 않는다.
- #70 artifact 기능은 실험과 달리 진단 가치가 있을 수 있어 자동 폐기하지 않는다. 현대 SDK 감사 경로에 재설계할지 사람이 판단한다.
- sdk-crosscheck / tools/sdk-reference는 같은 레거시 취약 체인을 두 번 유지한다. #80의 단일 현대 verifier가 대체 후보이지만 고정 oracle와 이전 테스트 출처를 보존해야 한다.
- `docs/research/archive/pr27-*`는 원본 위협 모델 보존 자료다. '실험 코드'라는 이유로 삭제할 대상이 아니다.
- main의 Four-Way JS 모형과 Guardian Rust 코드는 모델 검증/온체인 구현이라는 층위가 다르다. 단순 중복으로 지우지 않는다.
- #65·#66과 main 운영 문서는 역할·큐·상태를 중복 정의한다. NOW를 활성 큐로 두고 나머지는 목적·관측 시각을 명시한 기록으로 정리한다.

모든 항목은 제안이며 이번 PR에서는 파일·manifest·workflow·PR·branch를 삭제하지 않는다.

## 8. 열린 PR 전체 우선순위·의존성 목록

아래 CI는 head SHA에 연결된 check-run의 관측 결과다. merge 검사는 현재 main과의 별도 결과다. 각 PR의 변경 파일 전체와 check URL은 증거 JSON을 참조한다. P0-2/P0-3은 기존 NOW 작업 묶음 이름이며 새 동시 작업 배정이 아니다.

### #20 — P0-3 / Wallet 체인 루트

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/20), head `76accb296d3e2d200b4457c36ea5b4270a3f66b6`.
- base `main` → head `feature/shah-wallet-v1-20261025`; Draft; 10파일. GitHub target 상태: behind.
- CI: skipped 1, success 3.
- 판단: 독립 Devnet Wallet RC 구현. 기존 main과 텍스트 병합 가능하지만 최종 main+현대 SDK+Wallet 통합 QA는 별도 필요.

### #22 — P0-3 / #20 후속

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/22), head `c05d3e1cabf2231900668e7cfc79b02d5055eea5`.
- base `feature/shah-wallet-v1-20261025` → head `feature/shah-wallet-multichain-v1-1-20261025`; Draft; 12파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: 멀티체인 Mainnet 잔액 읽기 전용. SHAH Devnet과 자산·네트워크 분리, issuer contract 및 실제 확장 QA가 필요.

### #23 — P0-3 / main 충돌 해결 필요

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/23), head `ee5f9c1b431788bb0fdc21426193ca73f98da437`.
- base `feature/shah-wallet-multichain-v1-1-20261025` → head `feature/dashboard-wallet-multichain-integration-20261025`; Draft; 9파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: Dashboard↔Wallet 동일 origin 통합 및 #62 clipboard 수정 포함. main의 tokenomics/UI/server 변경과 3개 파일 충돌.

### #26 — HOLD / CI 실패 / 별도 권한 검토

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/26), head `e4c7745eff02a85943583272492c4f69463414fa`.
- base `main` → head `feature/release-gate-3a-signing-20261025`; Draft; 3파일. GitHub target 상태: behind.
- CI: skipped 1, failure 1, success 1.
- 판단: Gate 3A 서명 준비 endpoint. Dashboard CI 230 통과·1 실패. 자금 이동이 없어도 서명 준비 의미가 바뀌므로 본 작업에서 수정·통합하지 않는다.

### #54 — P0-2 / 연구 체인 루트

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/54), head `f9ce989d2a97aa50653d5a30fbf82d0fa7b6fbe7`.
- base `research/four-way-architecture-reconcile` → head `research/guardian-g1-state`; Draft; 4파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: G1 state-only Rust Solana 프로그램. #53 head 포함 확인. 현재 main은 포함하지 않으므로 main 동기화 후 Cargo 및 런타임 근거 구분.

### #55 — P0-2 / 선행 설계

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/55), head `5a95d0c08c91866d9abd3fca67971609beddd80b`.
- base `research/guardian-g1-state` → head `research/guardian-g2-design`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 2.
- 판단: G2 복구 설계. #54 이후 #56·#57 구현의 검토 기준.

### #56 — P0-2 / 선행 필수

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/56), head `67dbd2b8e4a8120845528be4e80fbbad84ee6db3`.
- base `research/guardian-g2-design` → head `research/guardian-g1-stable-pda`; Draft; 2파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: owner 변경 이후 PDA 정체성을 유지하는 config_seed 및 state v2. 상태 레이아웃 변경이므로 #57보다 먼저 검토.

### #57 — P0-2 / 연구 구현

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/57), head `db8df8a287dbf08fd6b365cbb79dcedaf715f679`.
- base `research/guardian-g1-stable-pda` → head `research/guardian-g2-implementation`; Draft; 2파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: 인증된 G2 복구 state/entrypoint 구현. token custody·Treasury·Falcon 결합과 실제 SBF 실행 증거는 없음.

### #58 — P0-2 / 연구 테스트 구현

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/58), head `dd510794dc08d06c5ca218d0ecfddf6b46052d81`.
- base `research/guardian-g2-implementation` → head `research/guardian-g3-replay-timing`; Draft; 2파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: nonce 재사용, 지연·만료 경계, guardian-set version 회귀. host cargo unit test이며 배포된 프로그램 검증이 아니다.

### #59 — P0-2 후속 / D0 읽기 전용

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/59), head `90e98568bf4a5b77affd95b283e036804ef4c4df`.
- base `research/guardian-g3-replay-timing` → head `research/devnet-d0-readonly`; Draft; 4파일. GitHub target 상태: clean.
- CI: skipped 1, success 4.
- 판단: 실제 genesis·slot·version 조회 workflow 및 안전성 테스트. PR-trigger도 존재하므로 수동 전용이라고 부르면 부정확. 최종 통합 SHA에서 재확인 필요.

### #60 — 설계 검토 / 실행 보류

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/60), head `5427caa5cd9ce60031ec8ec78f4c0f563250ba59`.
- base `research/devnet-d0-readonly` → head `research/devnet-d1-design`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 2.
- 판단: D1 폐기형 Devnet SOL 실험 설계만 존재. #59 뒤 문서로 검토 가능하나 실제 생성·서명·전송 실행은 이 작업 범위 밖.

### #63 — 운영 문서 검토 / 독립 main 대상

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/63), head `c61c8e31be5c78a37d5ff3dcacbc226d9330331f`.
- base `main` → head `planning/mvp1-integration-gates-20261027`; Draft; 1파일. GitHub target 상태: behind.
- CI: skipped 1, success 2.
- 판단: MVP 통합 및 보안 게이트 제안. 기존 RELEASE_GATES·NOW·BLOCKERS와 겹치므로 문서 책임 범위를 정한 뒤 선택적으로 통합.

### #65 — 운영 문서 수정 필요 / main 대상

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/65), head `4e56473d546ec6d6838d2c5717e4e550a12bef6c`.
- base `main` → head `ops/command-center-2-20261027`; Draft; 2파일. GitHub target 상태: behind.
- CI: skipped 1, success 2.
- 판단: 현재 NOW·AGENTS와 역할·우선순위가 충돌한다. #52·#53 미병합 전제를 제거하고 제안·확정 규칙을 구분한 뒤 인간 검토.

### #66 — 운영 문서 수정 필요 / #65에 의존

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/66), head `23870b9255d7a0a876ee84c9018c156612989a10`.
- base `ops/command-center-2-20261027` → head `ops/pr-triage-20261027`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 2.
- 판단: 40개 PR 스냅샷, 병합된 PR 및 Gemini 배정이 낡았다. 최신 #65 head도 포함하지 않으므로 순차 동기화와 내용 수정 필요.

### #67 — P0-3 후속 / 부모 동기화 필요

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/67), head `e07d2fb7ed4b401216a4bc90d10d6fdb525e1ffb`.
- base `feature/dashboard-wallet-multichain-integration-20261025` → head `collab/wallet-evm-consent-race-20261027`; Draft; 2파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: EVM 동의 응답 경쟁 조건 수정. 최신 #23 및 #62 clipboard 수정 커밋을 포함하지 않음. #23 동기화 후 회귀 테스트 필요.

### #70 — 보류 / #80과 충돌

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/70), head `8017b2a631be900636c0cdb1be1b22ad105e501d`.
- base `main` → head `security/b011-audit-evidence-20261027`; Draft; 1파일. GitHub target 상태: unstable.
- CI: skipped 1, failure 2, success 2.
- 판단: 기존 audit JSON 업로드 개선은 유용하나 현대 guard와 충돌한다. 필요 시 현대 SDK 경로에 맞게 별도 제안; 기존 PR 그대로 병합하지 않는다.

### #71 — 실험 보관 후보 / 대체 검토 필요

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/71), head `48e029d14534b05c9a7be419cad40b93652f0086`.
- base `main` → head `security/b011-transitive-override-probe-20261027`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 4.
- 판단: 임시 override 실험. #80의 조상은 아니므로 커밋 포함을 주장하면 안 된다. 결과 보관 후 내용 기반 대체 승인이 필요.

### #72 — 대체 후보 / CI 승인 대기

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/72), head `40738a36c7b19314622a768feed49135e7890565`.
- base `main` → head `security/b011-lockfile-overrides-20261027`; Draft; 5파일. GitHub target 상태: blocked.
- CI: check 없음 / workflow action_required.
- 판단: stream-json·uuid override와 자체 lockfile 커밋 workflow. high 취약점 미해결. 현재 head action_required. #80과 따로 병합 금지 권고.

### #73 — 실험 보관 후보 / 보존

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/73), head `7a63ab5e8e76461a4d78c3af0354059c75020f36`.
- base `security/b011-lockfile-overrides-20261027` → head `security/b011-bigint-exposure-probe-20261027`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 4.
- 판단: bigint-buffer 개발 의존성 노출 조사. 성공한 probe는 원래 취약점 해결 증거가 아니다.

### #74 — 실험 보관 후보 / 보존

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/74), head `d224edee69b9e2483d500c2fb51b651f08a0532f`.
- base `security/b011-bigint-exposure-probe-20261027` → head `security/b011-bigint-replacement-probe-20261027`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: 현대 SDK 의존성 분리 가능성 실험. #80 이후 정상 CI에 따로 추가할 필요 없음.

### #75 — 실험 보관 후보 / 보존

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/75), head `7878840c5856b05f415b2321c24188f57bf2666c`.
- base `security/b011-bigint-replacement-probe-20261027` → head `security/b011-modern-ata-byte-probe-20261027`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: 현대 ATA·instruction API 및 wire parity 탐색. CI 성공은 탐색 증거이며 운영 코드 전달이 아니다.

### #76 — 대체 후보 / CI 승인 대기 이력

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/76), head `95382fd10d08f8d9c3601da5d1f58fa405179f6c`.
- base `security/b011-modern-ata-byte-probe-20261027` → head `security/b011-sdk-migration-candidate`; Draft; 5파일. GitHub target 상태: unstable.
- CI: check 없음 / workflow action_required.
- 판단: 본문은 미검증 scaffold라고 하지만 현재 diff에는 lockfile과 verifier가 있다. 현재 head workflow는 action_required이며 통과로 취급하지 않는다.

### #77 — 대체 후보 / 보존

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/77), head `7c9a67759feb3db85265f0339721ba9793cbe517`.
- base `security/b011-sdk-migration-candidate` → head `security/b011-modern-ci-gate-20261027`; Draft; 2파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: 주 CI의 현대 SDK 전환 및 parity 확장. #80 통합 후보가 최종 경로.

### #78 — 실험 보관 후보 / 보존

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/78), head `fd4decf11d8fa930991d65c73383af19833eb3be`.
- base `security/b011-modern-ci-gate-20261027` → head `security/b011-retirement-inventory-20261027`; Draft; 1파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: 레거시 사용처 조사 workflow. #80에 head는 포함되지만 실험 workflow는 최종 파일 트리에서 제거되어 있다.

### #79 — 대체 후보 / 보존

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/79), head `2efc9d4b9e48411f110d91f8b0de2d83109e1d7d`.
- base `security/b011-retirement-inventory-20261027` → head `security/b011-retire-legacy-manifests-20261027`; Draft; 8파일. GitHub target 상태: clean.
- CI: skipped 1, success 4.
- 판단: 레거시 manifest 폐기와 guard 구현. #80에 정확한 현재 head가 포함되어 있으므로 별도 병합하지 않고 #80 승인 후 대체 여부 판단.

### #80 — P0 / 보안 통합 우선 검토

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/80), head `e77602463a19ef7f06acaf4528cf082679b41a91`.
- base `main` → head `security/b011-clean-integration-20261027`; Ready; 12파일. GitHub target 상태: clean.
- CI: skipped 1, success 3.
- 판단: 현재 main을 포함하는 보안 통합 후보. 인간 리뷰 및 문서 정합성 보완 후 #80만 squash 병합하는 방안을 권고한다. 미병합이므로 B-011은 OPEN 유지.

### #81 — P0-3 UI 보완 / 기존 Wallet 통합과 조정

- [GitHub PR](https://github.com/istars8370/shah-cat/pull/81), head `60d9d8fc764de87cf0595124af81b99ed624bad1`.
- base `main` → head `codex/p0-03-devnet-mvp`; Draft; 9파일. GitHub target 상태: clean.
- 현재 head check: Dashboard SUCCESS, SDK byte equivalence SUCCESS, Devnet missing-ATA SKIPPED.
- 판단: 읽기 전용 체험 안내, Treasury 성공 상태, MONO RUN 게스트 세션 계약/샘플 UI다. 실제 게임·점수 검증·보상·로그인·알림 구독 기능은 미완성이다.
- 본문의 233 Dashboard·4 SDK 로컬 통과는 작성자의 보고이며 이 P0-01에서 재실행한 379개와 섞지 않는다. 실제 390px/1440px 브라우저·확장 QA는 미완료라고 명시되어 있다.
- main 및 #80/#20과 텍스트 결합 가능. #23/#67과는 Dashboard 3파일 충돌, CSS는 경로 중복이다. 새 독립 기능 레인을 늘리지 않고 Wallet/Dashboard 기존 작업 묶음에서 통합한다.

## 9. 이번 변경 파일과 테스트 결과

브랜치: `codex/p0-01-integration-audit-20261027`. 부모: 위 main SHA.
추가 파일은 다음 세 개뿐이다.

- `docs/ops/P0-01-INTEGRATION-REPORT-20261027.md`: 한국어 현황·의존성·충돌·통합 계획·승인 요건.
- `docs/ops/p0-01-evidence-20261027.json`: 27개 PR, 정확한 SHA/check/변경 파일, ruleset, 감사 및 로컬 검증 근거.
- `docs/ops/p0-01-conflicts-20261027.json`: 실제 merge-tree 결과와 head 포함·경로 중복 근거.

검증:
- PASS: `node --test --test-reporter=tap dashboard/*.test.mjs research/four-way/*.test.mjs` → **379/379**, FAIL 0, SKIP 0. Windows, Node **v24.22.1**; 원격 CI는 Node 22이므로 환경 차이를 명시한다. 테스트는 fake RPC/mock wallet/localhost만 사용했다.
- 초기 샌드박스 실행은 자식 프로세스 spawn 제한으로 42개 테스트 파일 실행 실패. 같은 명령을 프로세스 제한 밖에서 재실행하여 위 379개를 통과했다. 이 초기 오류는 제품 기능 실패와 구분한다.
- PASS: `node --check dashboard/server.mjs`.
- PASS: 27개 GitHub head와 fetch한 PR ref 일치 확인, 26건 main 및 주요 14쌍 merge-tree 검사. 충돌 발견은 분석 결과이며 테스트 통과로 표시하지 않는다.
- PASS: #80 동결 fixture 및 Dashboard/scripts/research net diff 없음 확인.
- PASS: 추가 JSON 파싱·27 PR 고유성·근거/충돌 결과 일치·문서 링크 및 `git diff --check` 검증.
- 원격 관측 PASS/FAIL/action_required는 5절과 증거 JSON에 기록. #80 npm audit·3개 verifier 테스트는 **기존 GitHub CI 로그 검증**이며 이번 로컬 재실행으로 표현하지 않는다.
- NOT RUN: 이번 로컬에서 legacy/modern SDK npm install·npm audit, Guardian Cargo/SBF, 실제 RPC D0, 실제 확장 연결, 실제 지갑 서명, 전송·Treasury 이동·Mainnet·배포. Cargo 도구가 현재 PATH에 없고 이번 수정은 문서·근거 추가이므로 설치하지 않았다.

문서만 추가하여 런타임 동작은 바뀌지 않는다. 실제 제품 충돌 해결과 보안 의존성 폐기는 기존 해당 PR의 검토 범위로 남겼다.

## 10. 인간 승인 필요 항목

- 이 Draft의 분석 근거·권고 우선순위 및 이후 실제 병합.
- #80 Ready/Draft 상태 정리, 보관 문서 보완, SDK 검증 범위·패키지 출처·레거시 4파일 삭제와 squash 방식.
- #70~#79 대체/보관 여부, PR 종료 여부. source branch 삭제는 제안하지 않는다.
- #65·#66·#63의 현행 운영 규칙 반영 범위와 실제 담당자.
- #81 체험 UI의 브라우저 QA·Wallet 통합 순서와 Wallet 3파일 충돌의 의도 보존, 실제 확장 QA 및 통합 승인.
- Guardian 상태 레이아웃·권한/복구 로직과 향후 별도 runtime 증거 계획.
- required checks, 최소 인간 승인 수, Actions 권한/자동화 정책 변경.
- #26 서명 준비 변경은 별도 범위 승인. 실제 서명·토큰 전송·D1 실행·custody·Mainnet 배포는 이 보고서로 승인되지 않는다.

main 직접 수정, 기존 PR 자동 병합·종료·retarget, 임의 파일 삭제, 실제 토큰 전송·지갑 서명·Mainnet 배포는 수행하지 않았다. 최종 판단은 근거가 고정된 Draft PR을 통해 사람이 검토한다.
