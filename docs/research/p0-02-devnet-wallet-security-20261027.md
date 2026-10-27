# P0-02 Devnet 및 지갑 보안 검증

검증일: 2026-10-27 KST. 대상: `istars8370/shah-cat`.
기준 main: `fab83762da8aed49bfc7983136526643dc0827a6`.
작업 브랜치: `codex/p0-02-devnet-security-20261027`.
사용자가 요청한 P0-02 범위로 수행했으며, 기존 dependency/Wallet 통합 작업과 분리한 신규 연구 프로젝트가 아니다.
기존 폴더의 미커밋 변경은 보존하고 별도 작업 디렉터리를 사용했다.

## 판정 및 안전 경계

**오프라인 보완 PASS / D1 NOT EXECUTED / Mainnet NO-GO.**
처음에는 소스 및 테스트를 읽고 기존 mock 테스트를 수행했다. 이후 안전한 변경을 작성했다.
체인 RPC, faucet, 실제 지갑 연결·서명, 전송, ATA 생성, Treasury 조회·접근,
키 생성, Mainnet, 배포 및 병합은 수행하지 않았다.
기존 테스트의 운영 주소 문자열은 fake RPC/VM fixture에서만 사용된다.
새 회귀 테스트는 운영 주소와 다른 합성 공개 바이트를 사용하며 비밀키를 생성하지 않는다.
네트워크 사용은 GitHub 코드/CI 조회, 공식 문서 확인 및 npm advisory 조회로 한정했다.

## 재현한 문제와 수정

- P2 / ATA 부재 오인: `getAccountInfo` 결과가 undefined/null/빈 객체이거나 `value`가
  빠져도 계정이 없다고 판단하여 ATA 생성 명령을 포함한 시뮬레이션까지 진행했다.
  이제 응답에 `value`가 명시되어야 하며, 오직 `value: null`만 부재로 인정한다.
  기존 정상 계정의 프로그램·owner·mint·initialized state·decimals 검증은 유지된다.
- P2 / block height 검증 누락: `lastValidBlockHeight` 누락·음수·소수·문자열·unsafe integer를
  허용했다. 이제 0 이상의 안전한 정수만 수용한다. 이는 응답 형식 검증이며 실제 만료 여부의
  증거가 아니다. 정상 형태여도 이미 만료된 blockhash는 실제 RPC 시뮬레이션이 실패해야 한다.
- P2 / 시뮬레이션 이후 cluster 확인 누락: 첫 검사와 시뮬레이션 직전 genesis는 확인했지만
  시뮬레이션 동안 변경된 cluster를 성공으로 반환할 수 있었다. 반환 직전에 genesis를 다시 확인한다.
  동일 RPC가 거짓말하는 상황까지 방지하지는 못한다.
- P2 / 오류 원문 노출: `simulation.value.err` 전체를 문자열화해 HTTP 오류와 서버 로그로 전달했다.
  이제 정해진 오류 메시지만 반환한다. 다른 RPC/transport 오류의 일반적인 redaction 문제는 아래 잔여 위험이다.

서명·전송 기능이나 권한을 추가하지 않았다. 안전 검증만 엄격하게 했으며,
정상 missing-ATA 경로의 unsigned CreateIdempotent + TransferChecked 시뮬레이션은 유지된다.

## 검증 결과와 재현 절차

로컬 Node `v24.22.1`, PowerShell에서 실행했다. CI는 Node 22를 사용한다.

1. 기존 선택 범위 13개 테스트 파일: **199 PASS / 0 FAIL**.
2. 수정 전 신규 보안 테스트: **15개 중 3 PASS / 12 FAIL**.
   실패는 ATA 오류 응답 4개, block height 6개, 사후 genesis 1개, 오류 payload 노출 1개였다.
   상세는 [before.txt](p0-02-evidence/before.txt).
3. 수정 후 새 guard/정상 missing-ATA 경로를 포함한 선택 범위:
   **216 PASS / 0 FAIL / 0 SKIP**. [after.tap](p0-02-evidence/after.tap).

```powershell
node --test --test-reporter=tap --experimental-test-isolation=none scripts/run-offline-security.mjs
```

Windows sandbox에서 기본 `node --test`는 테스트 파일을 실행할 자식 프로세스를 생성하지 못해
`spawn EPERM`으로 13개 파일이 실패했다. 제품 assertion 실패와 구분된다.
Node의 `--experimental-test-isolation=none`으로 같은 프로세스에서 재현했다.
Ubuntu CI의 명령은 `node --test scripts/run-offline-security.mjs`이다.

수정 전 재현은 기준 main의 소스와 신규 `dashboard/devnet-security.test.mjs`를 결합해
`node --test --experimental-test-isolation=none dashboard/devnet-security.test.mjs`를 실행한다.
최종 파일에는 이후 추가된 정상 missing-ATA 1개가 있어 총 16개 중 동일한 12개가 실패해야 한다.
현재 브랜치에서는 같은 16개가 모두 통과한다.

검증 범위는 shared 정수/주소, 프로젝트 설정, 고정 SDK fixture,
SPL preflight/unsigned quote, Wallet Standard·Phantom·Solflare 모의 연결,
계정 변경/취소/지연 응답/동의 거절, preflight·quote UI 무효화,
Devnet read-only/receipt의 부정 사례다. 새 테스트는 zero placeholder signature,
`sigVerify:false`, `replaceRecentBlockhash:false`, 서명/방송 비활성도 확인한다.
실제 확장 프로그램의 동의 UX와 실제 RPC 결과는 **NOT RUN**이다.

추가 workflow `offline-devnet-security.yml`은 pull_request/main push에서 실행한다.
의존성 설치, credentials 저장, live RPC, secrets 주입 및 수동 live dispatch가 없다.
선택 범위는 Treasury 테스트/endpoint 및 소켓 기반 smoke test를 제외한다.
preload tripwire가 fetch·일반 socket/HTTP·subprocess·일반 파일쓰기 API를 거부하고
차단 동작 자체도 시험한다. native addon/worker/direct binding까지 격리하는 OS sandbox는 아니다.
기존 전체 Dashboard/SDK CI 및 별도 dependency guard는 그대로 유지한다.

## SPL·ATA·RPC 및 사용자 동의 평가

- raw amount를 uint64 BigInt로 검증하고 TransferChecked opcode 12/9 decimals를 사용한다.
  canonical mint, legacy Token Program, on-curve 수신자, source balance/state,
  수신 ATA owner/mint/state/precision을 확인한다. Token-2022/PDA 수신자는 지원하지 않는다.
- missing-ATA의 165-byte rent와 exact message fee를 조회하고 0.01 SOL reserve를 확인한다.
  서명 1개 슬롯은 64-byte zero buffer이며 quote API는 wire bytes를 사용자에게 반환하지 않는다.
  고정 SDK fixture 테스트는 통과했다. 별도 SDK 의존성을 설치해 공식 SDK를 새로 실행하는
  `sdk-crosscheck` 로컬 검증은 **NOT RUN**이며 기존 CI 결과와 구분한다.
- Wallet Standard accounts의 address/publicKey 일치와 `solana:devnet`을 검증한다.
  injected connector는 공개 주소 연결이며 확장 프로그램 네트워크를 변경하지 않는다.
  자동 연결 대신 사용자 click으로 동의를 요청하고, account/change/disconnect 및 늦은 응답을 처리한다.
  모의 지갑의 signing API는 호출되면 실패하도록 구성되어 있다.
- 별도 EVM Wallet 통합 PR #67(`e07d2fb7ed4b401216a4bc90d10d6fdb525e1ffb`)의
  consent race 수정은 main에 없다. 해당 head의 CI run 40426343651은 success이지만,
  이 작업에서 그 브랜치의 확장 프로그램이나 Mainnet 지갑을 실행하지 않았다.

## PR #60 D1 설계와 실행 준비 비교

확인한 head: `5427caa5cd9ce60031ec8ec78f4c0f563250ba59`, base:
`research/devnet-d0-readonly`. Draft/open, 문서만 변경된 설계다.
[CI run 40427750237](https://github.com/istars8370/shah-cat/actions/runs/40427750237)은 success다.
그 결과는 Dashboard/SDK 검증이며 D1 runner 또는 M01–M24 실행 증거가 아니다.

설계에는 별도 인간 승인, manual-only trigger, same-run D0, 전후 genesis,
fresh ephemeral identity, faucet finalized receipt, 1,000 lamports 단일 SOL 전송,
fee 10,000/debit 11,000 상한, RPC 10초/단계 60초/총 180초 제한,
단일 제출·재시도 금지, finalized receipt의 메시지/잔액/수수료 검증,
공개 증거 allowlist 및 cleanup 조건이 있다.

실행 runner와 전체 M01–M24 mock suite는 그 PR에 없다. 이번 unsigned SPL 테스트는
그 SOL D1 runner의 대체 구현이 아니며, D1 acceptance로 계산하면 안 된다.
기존 Dashboard는 Treasury 주소를 참조하는 missing-ATA live probe와 15초 RPC timeout을
사용하므로 D1의 disposable SOL 경로/10초 한도/승인 gate로 재사용할 수 없다.
`scripts/verify_gate2b_missing_ata.mjs` 및 그 branch-scoped 기존 CI job은 실행하지 않았다.

결론: **설계 검토 가능 / 실행 HOLD**. 승인 정책·승인자 확정, 별도 D1 offline 구현/필드별
부정 사례, 정확한 수수료·rent·시간 조건 검증 및 별도 live 승인이 필요하다.
SHAH token transfer, custody, Guardian/Falcon 또는 Mainnet 준비 상태를 입증하지 않는다.

## 비밀정보 및 의존성 감사

`python scripts/scan-secret-patterns.py --history`로 현재 추적 파일과 HEAD에서 도달 가능한
이력 blob을 읽기 전용 검사했다. 값은 출력하지 않고 rule/path 또는 blob ID만 보고한다.
결과 및 실제 검사 수는 [secret-scan.json](p0-02-evidence/secret-scan.json)을 참조한다.
PEM, GitHub token, AWS key, 문자형 wallet-secret literal, 독립 JSON 64-byte key 배열과
민감 파일명을 검사한다. 초기 161 tracked files / 293 history blobs에서 일치 0건이었다.
Gitignore에 `.env`, wallet/keypair JSON, PEM 제외 규칙이 있다.
이는 heuristic 검사이며 BIP39/entropy 검사, 외부 로그·artifact, ignored/untracked 파일,
remote-only 이력 전체 및 삭제된 자격증명의 실제 유효성까지 확인하지 않는다.

오프라인 검증 후 설치나 lockfile 변경 없이 npm advisory DB를 읽었다:

```powershell
npm.cmd audit --prefix sdk-crosscheck --package-lock-only --ignore-scripts --json
npm.cmd audit --prefix tools/sdk-reference --package-lock-only --ignore-scripts --json
```

두 도구 각각 **High 3 / Moderate 6 / 총 9 affected-package entries**.
두 도구 사이 및 전이 의존성 항목은 중복되므로 unique vulnerability 18개로 계산하지 않는다.
전체 응답: [SDK crosscheck](p0-02-evidence/sdk-crosscheck-audit.json),
[SDK reference](p0-02-evidence/sdk-reference-audit.json).
`@solana/spl-token -> @solana/buffer-layout-utils -> bigint-buffer` 경로가 포함된다.
[GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg)는
`bigint-buffer <=1.1.5`의 High buffer overflow이며 공식 advisory에 patched version이 없다.
이는 dev SDK 도구 의존성으로, Dashboard runtime exploitability 입증과는 구분한다.
강제 업데이트나 advisory 무시는 하지 않았다.

기존 PR #80 head `e77602463a19ef7f06acaf4528cf082679b41a91`은
modern SDK 전환/legacy manifest 제거를 다룬다. 해당 head의
[CI 40439763601](https://github.com/istars8370/shah-cat/actions/runs/40439763601),
[dependency guard 40439763720](https://github.com/istars8370/shah-cat/actions/runs/40439763720)는 success였다.
확인 시 draft=false/open이며 main에는 반영되지 않았다. 해당 수정은 중복 구현하지 않았다.
따라서 **main 기준 B-011은 OPEN**이며 이 보안 PR의 통과로 해소되지 않는다.

## 남은 기술적 문제 및 다음 검토

- B-011 High 의존성: #80 정확한 diff/lock/byte-equivalence 및 통합 결과를 검토한 후 별도 처리.
- Dashboard 기본 RPC adapter는 JSON-RPC version/id/result envelope를 엄격히 상관 검증하지 않고,
  일반 transport/RPC 오류 원문을 HTTP/console에 전달한다. 기존 D0의 hardened adapter와
  일관성을 맞추는 별도 수정이 필요하다. 이번 simulation error 축소만으로 전체 redaction 완료라 할 수 없다.
- `transferReadiness` 단독 결과는 source의 outer Token Program owner/type 검증이 없고,
  수신 ATA/curve·fee·rent·simulation 미검증이라는 제한을 명시한다.
  quote는 이 추가 검증을 수행한다. preflight 성공을 서명 승인으로 승격하면 안 된다.
- 실제 확장 프로그램 동의, SDK 재설치 검증, live genesis/ATA/simulation,
  D1 M01–M24 및 실제 finalized receipt는 **NOT RUN**.
- 이 검증은 내부 코드/모의 테스트이며 독립 외부 감사나 Mainnet release 승인이 아니다.

공식 unsigned simulation 의미는 [Solana simulateTransaction 문서](https://solana.com/docs/rpc/http/simulatetransaction)를 확인했다.
이번 실행에는 Solana endpoint를 호출하지 않았다. D1/Mainnet/Treasury/서명·전송은 계속 HOLD다.
