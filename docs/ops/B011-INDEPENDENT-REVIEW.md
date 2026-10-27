# B-011 추가 내부 검토 및 SDK 호환성 근거

검증일: 2026-10-27 KST. 이 문서는 Codex의 **내부 검토**이며 독립 외부 보안 감사나 인간 승인이 아니다.
작업 브랜치: `codex/b011-review-hardening-20261027`.
검토 대상: [PR #80](https://github.com/istars8370/shah-cat/pull/80).
기준 main: `fab83762da8aed49bfc7983136526643dc0827a6`.
검토 입력 head: `e77602463a19ef7f06acaf4528cf082679b41a91`.

## 판정

**제한된 byte parity PASS / 비정규 curve 의미 차이 발견 / 인간 검토 필요 / main B-011 OPEN**.

조회 당시 #80 API는 open, Draft=false, 인간 제출 리뷰 0건이다.
이전 문서의 DRAFT·0e92c11 SHA·11파일 서술은 현재 입력과 달랐다.
위 입력의 main 대비 net diff는 12파일, history는 48커밋이며 main을 포함한다.
이 후속 Draft의 추가 파일 수를 #80 입력 스냅샷에 혼동하지 않는다.

#80의 동일 head에 연결된 기존 CI:
- [SHAH CAT CI 40439763601](https://github.com/istars8370/shah-cat/actions/runs/40439763601): SUCCESS.
- [SDK dependency guard 40439763720](https://github.com/istars8370/shah-cat/actions/runs/40439763720): SUCCESS.

새로 열린 #84의 #80+#83 결합 검증 workflow가 성공한 것을 조회했으므로
여기에 같은 결합 workflow를 추가하지 않았다. #85의 Wallet 충돌 probe는 별도 작업으로 남겼다.
이 결과가 실제 Wallet/브라우저 QA나 승인으로 이어지지는 않는다.

## 새로 재현한 호환성 차이

원래 `sdk-crosscheck/sdk-equivalence.test.mjs`의 거래 입력은 동결 oracle와 다르다.
원래 treasury를 payer로 쓰고 실제 ATA를 source로 계산하며 0 blockhash와 raw 1/10^9/10^12를 사용한다.
동결 oracle는 development payer, 별도 고정 source/blockhash, raw uint64 최댓값을 포함한다.
따라서 기존 6개 oracle 비교만으로 원래 crosscheck의 모든 입력을 재실행했다고 말할 수 없었다.

새 `runtime-crosscheck.test.mjs`는 원래 6개 조합의 ATA·instruction metadata/data·runtime message·
unsigned wire를 현대 SDK와 직접 비교한다. 모두 일치했다. 64-byte 서명 슬롯은 0으로 유지한다.
기존 동결 oracle와 원본 legacy test는 수정하지 않는다.

curve 69개를 추가 비교한 최초 실험은 **12개 테스트 중 11 PASS / 1 FAIL**이었다.
실패한 입력은 32-byte all-ff의 주소
`JEKNVnkbo3jma5nREBBJCDoXFVeKkD56V3xKrvRmWxFG` 하나다.
Kit 6.10.0의 `isOffCurveAddress`는 false(on-curve), 역사적 oracle와 현재 runtime은 false(on-curve 아님)다.

설치된 SDK의 `@solana/addresses/dist/index.node.mjs`를 확인했다.
`compressedPointBytesAreOnCurve` → `pointIsOnCurve`가 y 제곱을 mod p로 계산하는 반면,
runtime `dashboard/transfer-quote.mjs`는 먼저 y>=p를 거절한다.
all-ff는 마지막 sign 비트를 제거해도 y=2^255-1이므로 비정규 경계 입력이다.
이 관측만으로 실제 Solana 런타임의 모든 곡선 규칙이나 SDK 취약성을 단정하지 않는다.

테스트를 무조건 동등하다고 바꾸지 않고, 다음 세 조건을 함께 검증했다.
- 69개 base58·runtime 판정은 원래 oracle와 일치.
- 현대 SDK와의 불일치는 정확히 all-ff 하나이며 68개는 일치.
- 현재 production ATA derivation 경로는 해당 주소를 계속 거절.

최종 테스트의 성공은 알려진 의미 차이를 명시적으로 재현하고 동작 보존을 확인한다는 뜻이다.
69개 curve의 완전한 동등성, 변경 승인, 취약점 면제는 아니다.
사람은 이 범위가 #80의 38 ATA·6 message 검증 목적에 충분한지 판단해야 한다.
현대 curve API의 운영 대체·PDA edge-case 확대·upstream 이슈 제기는 별도 검토 사항이다.

## 의존성과 보관 소스 점검

- exact manifest: kit 6.10.0, token 0.10.0 유지.
- lockfile v3: root 제외 47개 package, 모든 resolved URL은 registry.npmjs.org,
  integrity 존재, hasInstallScript 항목 0, bigint-buffer 항목 0.
- lockfile 표기 license: MIT 46개, Apache-2.0 1개. 법률 판단·서명 provenance 검증은 수행하지 않음.
- `npm ci --ignore-scripts`로 47개 설치 성공. global tool 변경 없음.
- 전체 개발 의존성 포함 `npm audit --package-lock-only --audit-level=high --json`:
  info/low/moderate/high/critical 모두 0. advisory는 실행 시점 결과다.
- `git grep`으로 .github/scripts/dashboard/tools/README의 legacy 실행 참조를 확인했다.
  활성 workflow의 legacy manifest 경로는 재도입 방지 검사다. 원본 legacy generator와 test import는
  의도적으로 남긴 보관 소스이며 관리되는 실행 경로가 아니다.
- `tools/sdk-reference/README.md`에만 보관 안내가 있던 문제를
  `sdk-crosscheck/README.md` 추가로 보완했다.
- 동결 fixture blob: `73e8645c26ec02dca08b7c36b9fa01dd58acbc0d`. 변경 없음.
- 이 후속 diff는 manifest/lockfile/runtime/workflow 삭제 또는 변경을 포함하지 않는다.
  #80의 레거시 manifest 4개 삭제 제안을 복제하거나 main에 실행하지 않는다.

## 검증 결과

로컬 환경: Windows, Node v24.22.1, npm 11.19.1. CI 기준은 Node 22다.

- PASS: `npm ci --prefix tools/sdk-modern --ignore-scripts --no-audit --no-fund` — 47개 설치.
- PASS: `npm test --prefix tools/sdk-modern` — 기존 3 + 신규 10 = **13/13**, FAIL/SKIP 0.
- PASS: `node --test --test-reporter=tap dashboard/*.test.mjs research/four-way/*.test.mjs` —
  **379/379**, FAIL/SKIP 0.
- PASS: 현대 SDK full lockfile audit — **0 vulnerabilities**.
- PASS: manifest/lock/fixture/runtime/workflow 불변, 새 test 구문 및 diff whitespace 검사.
- NOT RUN: 레거시 SDK 재설치·generator 실행, 실제 RPC/Wallet 연결·서명·방송,
  프로그램 배포, Token-2022/multisig, 독립 외부 감사, 법률 검토, supply-chain 서명 검증.

새 head의 CI는 이 문서 작성 후 생성되는 Draft에서 확인해야 한다.
과거 #80 CI가 새 테스트를 실행했다고 주장하지 않는다.

## 변경 파일 및 인간 판단

1. `tools/sdk-modern/runtime-crosscheck.test.mjs`: 원래 입력의 직접 비교와 curve 의미 차이 기록.
2. `sdk-crosscheck/README.md`: 원본 보관 목적과 현대 실행 경로 안내.
3. `tools/sdk-modern/README.md`: 실제 Ready 상태·검증 범위·제한 갱신.
4. 이 문서: 재현 결과와 남은 판단 기록.

후속 Draft는 #80 브랜치 위에 쌓아 네 파일만 리뷰할 수 있게 한다.
검토 후 #80에 통합하려면 사람의 승인이 필요하며, 최종 main 후보의 net diff·CI·audit을 다시 확인한다.
#80만 squash하는 기존 권고는 유지한다. 원본 branch/PR을 자동 종료하지 않는다.
B-011/#69는 main 미병합이므로 종료하지 않는다.
NO-GO: 무인 병합, signing/custody 변경, 실제 전송, Treasury 이동, Mainnet 배포.
