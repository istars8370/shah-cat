# Solana SDK 오프라인 기준 데이터

이 도구는 대시보드 런타임과 분리된 개발용 검증 도구입니다. 개인키 생성·접근, RPC 연결, 서명, 전송을 하지 않습니다. 공개 주소와 결정적 SHA-256 입력만 사용합니다.

고정 버전: `@solana/web3.js 1.98.4`, `@solana/spl-token 0.4.15`. 전이 의존성은 `package-lock.json`으로 고정합니다. 생성기는 대시보드 코드를 import하지 않으며 SDK의 ATA 계산, SPL instruction 생성, Message/Transaction 직렬화를 사용합니다.

저장소 루트에서 실행:

```powershell
npm ci --prefix tools/sdk-reference --ignore-scripts
node tools/sdk-reference/generate.mjs --check
node --test dashboard/sdk-reference.test.mjs
```

기준 데이터를 의도적으로 갱신할 때만 `--check`를 빼고 실행하고, JSON diff를 검토합니다. 일반 CI는 저장된 `dashboard/fixtures/solana-sdk-reference.json`과 비교하므로 SDK 설치나 외부 접속이 필요 없습니다. SDK 자체 재생성 검증은 별도 명령이며 기존 CI에서 자동 실행되지 않습니다.

검증 범위:

- 69개 공개키 바이트의 곡선 판정·Base58 왕복 및 38개 on-curve 소유자의 ATA 계산.
- 기존 ATA / 신규 ATA 각각 최소 단위, 1 SHAH, u64 최대값의 6개 메시지와 제로 서명 wire 바이트.
- 실제 `quoteUnsignedTransfer`가 mock RPC의 수수료 조회·시뮬레이션에 넘기는 전체 payload 비교.
- 원격 개발 브랜치의 정렬 수정과 통합했습니다. 기준 메시지는 SDK Transaction.compileMessage()로 직접 생성하며, 계정 인덱스 재배치 없이 공식 SDK 기본 직렬화 바이트와 비교합니다.

제한 및 의존성 위험:

- 이 벡터들은 모든 Ed25519 인코딩이나 임의 instruction을 증명하지 않습니다. Token-2022, PDA 수신자, 다중서명, Mainnet, 실제 지갑·RPC 통합은 검증 범위 밖입니다.
- 2026-10-22 실행한 `npm audit`은 개발 의존성에서 High 3개, Moderate 6개를 보고했습니다(전이 영향 포함). `bigint-buffer`, `jayson` 하위 `stream-json`/`uuid` 관련 경고가 포함됩니다. 보고 수는 감사 DB에 따라 변할 수 있습니다.
- 설치 스크립트를 끄고 실행했으며 `bigint-buffer`는 native binding 없이 pure JS fallback을 사용했습니다. 이는 취약점 전체가 해결됐다는 뜻이 아닙니다. 이 SDK 묶음을 서버/브라우저 런타임이나 외부 입력 처리에 사용하지 마세요. 런타임 도입 전에는 별도 의존성 검토가 필요합니다.
- 검증 성공은 Mainnet 출시 승인이나 실제 거래 성공을 의미하지 않습니다.
