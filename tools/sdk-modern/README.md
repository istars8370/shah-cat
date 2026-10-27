# 현대 Solana SDK 오프라인 검증기 — B-011

검토 기준: PR #80 head `e77602463a19ef7f06acaf4528cf082679b41a91`.
2026-10-27 조회 당시 #80은 **open / Ready(Draft=false) / 인간 리뷰 미제출 / main 미병합**이다.
GitHub 상태는 변경 가능하므로 병합 직전에 다시 확인한다. 이 도구는 개발 검증용이며 운영 Wallet이 아니다.

## 재현

Node.js 22가 CI 기준이다. 로컬 추가 검증은 Node 24.22.1 / npm 11.19.1에서 실행했다.

```sh
npm ci --prefix tools/sdk-modern --ignore-scripts --no-audit --no-fund
npm test --prefix tools/sdk-modern
npm audit --prefix tools/sdk-modern --package-lock-only --audit-level=high
```

kit 6.10.0, token 0.10.0과 lockfile을 그대로 유지한다. lockfile에는 registry.npmjs.org 출처와
integrity가 있는 패키지 47개, MIT 46개 / Apache-2.0 1개가 기록되어 있다.
이는 manifest/lock 정적 검사이며 법률 검토나 배포 출처 인증을 대신하지 않는다.
설치 스크립트는 비활성화한다. force upgrade와 레거시 의존성 재설치는 하지 않는다.

## 검증 범위와 발견한 차이

- `fixture.test.mjs`: 동결 oracle의 38 ATA, 기존/누락 ATA 6개 legacy message·unsigned wire,
  instruction program/account/권한/data, amount·destination·program 부정 대조.
- `runtime-crosscheck.test.mjs`: 과거 crosscheck의 원래 8개 공개 주소·3개 지갑 ATA,
  0 blockhash, ATA 생성 유무 × raw 수량 1/10^9/10^12의 원래 거래 6조합을 현대 SDK와 직접 비교.
  실제 runtime의 compileLegacyMessage·unsignedWireTransaction을 사용한다.
- 기존 69개 curve 벡터의 base58와 runtime 판정은 유지된다.
  현대 SDK의 curve 판정은 **68개 일치 / all-ff 1개 불일치**다.
  마지막 비트 제거 후 y=2^255-1인 비정규 인코딩을 Kit는 모듈러 연산으로 받아들이고,
  기존 runtime은 y>=2^255-19 검사에서 거절한다.
- 새 테스트는 이 차이 목록을 정확히 고정하고 runtime ATA 경로가 계속 거절하는지 확인한다.
  호환성 차이를 기록하는 테스트의 성공은 69개 curve 동등성이나 사람의 예외 승인이 아니다.
  동결 fixture·runtime·의존성·workflow를 바꾸지 않는다.

로컬 결과: 현대 SDK **13/13 PASS**, Dashboard+Four-Way **379/379 PASS**, skip 0.
전체 개발 의존성 npm audit은 실행 시점 **0 vulnerabilities**다. main의 B-011 해결을 뜻하지 않는다.
레거시 소스 보관 안내: [sdk-crosscheck README](../../sdk-crosscheck/README.md).

## 검토와 제한

[추가 내부 검토 기록](../../docs/ops/B011-INDEPENDENT-REVIEW.md)의 입력 SHA·발견 사항·승인 항목을 확인한다.
동결 oracle를 현대 SDK로 다시 생성하거나 curve API를 운영 코드로 바꾸지 않는다.
키 생성·지갑 서명·RPC·방송·실제 전송은 실행하지 않는다.
Token-2022, 임의 거래·multisig, 실제 Wallet, Guardian/Falcon/custody/Mainnet 증거는 없다.
새 Draft와 #80 모두 인간 리뷰 전 병합하지 않는다.
