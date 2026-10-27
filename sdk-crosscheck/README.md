# 레거시 SDK crosscheck 보관 소스

이 디렉터리는 과거 `@solana/web3.js` 1.x / `@solana/spl-token` 0.4.x 검증의
출처를 보존한다. #80 후보에서 취약한 개발 의존성 manifest와 lockfile을 폐기하도록
제안했으므로 현재 설치·실행 대상으로 사용하지 않는다. 해당 삭제는 main 미병합이다.

현재 실행 경로는 다음과 같다. 저장소 루트에서 실행한다.

```sh
npm ci --prefix tools/sdk-modern --ignore-scripts --no-audit --no-fund
npm test --prefix tools/sdk-modern
npm audit --prefix tools/sdk-modern --package-lock-only --audit-level=high
```

`tools/sdk-modern/fixture.test.mjs`는 기존 동결 oracle와 현대 SDK를 비교한다.
`tools/sdk-modern/runtime-crosscheck.test.mjs`는 이 디렉터리의 원래 입력을 현대
SDK로 검증한다. 원래 공개 주소 8개, 지갑 3개의 ATA, 0 blockhash와 두 수신자에서
ATA 생성 유무 × 수량 3종(1, 10^9, 10^12 raw)의 instruction·message·unsigned wire를
확인한다. 기존 fixture의 69 curve/base58 벡터도 현대 SDK와 비교한다.
curve는 68개가 일치하고 all-ff 비정규 인코딩 1개는 의미 차이가 있다.
새 테스트는 이 차이를 명시적으로 기록하고 기존 런타임의 거절 동작을 확인한다.
69개 전부의 curve 동등성을 주장하지 않으며 현대 curve API를 운영 코드로 대체하지 않는다.

`sdk-equivalence.test.mjs`는 역사적 참조 자료다. 일반 CI에서 이 파일을 직접 실행하거나
취약한 manifest를 복원하지 않는다. 동결 fixture 재생성은 별도 인간 검토가 필요하다.
이 검증은 오프라인이며 실제 지갑 서명·전송·배포·Mainnet 안전성을 증명하지 않는다.
