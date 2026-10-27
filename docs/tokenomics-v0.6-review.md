# v0.6 문서 채택 기록·시행 검토표와 증빙

**검토 기준일:** 2026-10-27 (Asia/Seoul)
**문서 상태:** 성재의 지시로 문서 기준안 채택 (2026-10-27).
**경제 규정 시행:** 동원·박원의 동의와 시행일 미확정.
**검토한 main:** `7ca56b714a0b38cebf61fae769a8ca1f89084b2c`

[백서](../WHITEPAPER.md) · [v0.6 상세](tokenomics-v0.6-ko.md) · [v0.5 상세](tokenomics-v0.5-ko.md) · [v0.5 백서 보존본](whitepaper-v0.5-ko.md)

## 문서 채택 기록

- 일자: 2026-10-27 (Asia/Seoul).
- 지시 주체: 성재.
- 확인된 지시: v0.6 개정안 작성 및 PR #64 제시 후 “채택해줘”.
- 처리 범위: v0.6을 저장소의 백서·토크노믹스 문서 기준안으로 채택하고 main에 반영.
- 유지 사항: 총량·배분·해제·게임 보상 한도, 기존 v0.5 원문과 구현 정책 버전.
- 별도 확인: 동원·박원의 동의, 경제 규정 시행일, 계약·권리 변경과 실제 거래.

이 기록은 문서 채택 지시의 기록이며 지갑 메시지 서명·3인 서면 합의·실제 자금 집행의 증빙을 대신하지 않는다.

## 개정 요지

기술·지갑·운영 도구의 실제 고객 가치와 수익을 먼저 검증하고, 서비스별로 SHAH 사용 필요성을 확인한다. 게임은 별도 운영 경제로 구분한다. 기술 연구의 성과와 실제 자산 통제·유료 서비스 출시는 다른 상태로 공시한다.

| 항목 | v0.6 처리 | 채택·구현 구분 |
| --- | --- | --- |
| 정책상 총량 10억 | 유지 | 실제 Mint 공급·권한 상태는 별도 확인 |
| 개인 수량과 3인 합계 50% | 유지 | 집중도 재검토만 명시, 자동 삭감·증액 없음 |
| 용도별 수량·목적 | 유지 | 게임→기술 예산 전용은 별도 합의 안건 |
| 운영자 T13~T36·투자자 10%/24회 | 유지 | T0·실제 예치·청구 증빙 필요 |
| 게임 시범 월 500,000·누적 3,000,000 | 유지 | 게임 운영 개시 기준, 개정으로 재시작하지 않음 |
| 기술·서비스 정체성 | 추가 제안 | 서비스별 출시 카드와 실제 수요 검증 |
| 개발·보안 비용 | 검수·계약·중복 지급 통제 보강 | 예산 세부 비율·현금 견적 미정 |
| 수익과 SHAH 수요 | 결제·기존 잔액·보상 재사용 구분 | 가격·할인율·유료 고객·매출 미확정 |
| Treasury 겸용 주소 | 관리 역할·귀속 장부·출금 권한 구분 | 메시지 승인과 실제 다중서명 강제 구분 |
| 추가 발행·목적 예산 재편 | 비교 검토 과제 | 제안 수량·일정·거래 승인 없음 |

## 기존 경제량 교차 대조

- 배정 합계: 333,333,334 + 166,666,666 + 150,000,000 + 100,000,000 + 100,000,000 + 50,000,000 + 50,000,000 + 50,000,000 = **1,000,000,000 SHAH**.
- 개인 합계: 166,666,667 + 166,666,667 + 166,666,666 = **500,000,000 SHAH**.
- 박원: T0 자유 **16,666,666.6**, 제한 **149,999,999.4**, 24회 × **6,249,999.975 SHAH**.
- 초기 3인 누적: T0 **16,666,666.6**, T12 **91,666,666.3**, T24 **333,333,333**, T36 **500,000,000 SHAH**.
- 게임 시범: 6 × 월 최대 500,000 = 누적 최대 **3,000,000 SHAH**. 개인 상한 2%, 미사용분 자동 가산 없음.

실제 배포와 개인 보유량 확인이 아니라 문서 수량의 대조다. 기존 `dashboard/tokenomics.js`와 `dashboard/treasury-store.mjs`의 정책 버전·산식·서명 메시지는 이 개정에서 변경하지 않는다. `docs/tokenomics-v0.5-ko.md`는 기존 정책 보존을 위해 그대로 둔다.

## 채택 결정표

아래의 미기록·미확인은 아직 확보되지 않은 결정 또는 증빙이다. 성재의 문서 채택 지시 외에 문서 게시·PR 병합·테스트 통과를 다른 당사자의 동의로 채우지 않는다.

| 결정 항목 | 현재 권고/상태 | 채택 결과·근거 |
| --- | --- | --- |
| 기존 총량·배분·해제·게임 한도 유지 | 문서 기준 유지 | 성재 문서 채택 지시, 다른 당사자 동의는 별도 확인 |
| 기술 프로젝트와 게임의 운영 경제 구분 | v0.6 문서 기준 | 성재 문서 채택 지시, 경제 규정 시행은 별도 확인 |
| 첫 유료 서비스·고객·제공 범위 | 미정 | 미기록 |
| 가격·수락 자산·SHAH 할인·환불 | 미정 | 미기록 |
| 월 개발·감사·운영 비용과 지급 자산 | 실제 견적·현금 자료 필요 | 미기록 |
| 개인/공동 자금 귀속 대조 | 현재 겸용 관리 주소 기준 확인 필요 | 미기록 |
| 추가 발행/목적 예산 재편 필요성 | 현재 수량 유지, 변경 수량 제안 없음 | 미기록 |
| v0.6 시행일과 기존 약정·원장 처리 | 미정 | 미기록 |
| 정책 버전·서명 도구 전환 책임자 | 채택 후 별도 구현 검토 | 미기록 |

| 동의 주체 | 동의 일시·방법·증빙 |
| --- | --- |
| 성재 | 2026-10-27 채팅의 “채택해줘”로 문서 채택 지시 확인. 지갑 서명·3인 서면 합의는 미확인 |
| 동원 | 미확인 |
| 박원 | 미확인 |

별도 계약 또는 다른 수혜자의 권리를 변경한다면 해당 당사자의 동의와 적용 가능성도 확인한다. 모든 공란이 경제 실험을 즉시 실행해도 된다는 뜻은 아니다. 미승인 신규 재량 집행은 진행하지 않는다.

## 연구와 main 상태의 근거

기준 main의 [백서](https://github.com/istars8370/shah-cat/blob/7ca56b714a0b38cebf61fae769a8ca1f89084b2c/WHITEPAPER.md), [v0.5 정책](https://github.com/istars8370/shah-cat/blob/7ca56b714a0b38cebf61fae769a8ca1f89084b2c/docs/tokenomics-v0.5-ko.md), [Treasury 운영 문서](https://github.com/istars8370/shah-cat/blob/7ca56b714a0b38cebf61fae769a8ca1f89084b2c/docs/treasury-workflow.md)를 읽고 다음 PR의 상태·대상 브랜치·설명 또는 변경 문서를 확인했다. PR 상태는 검토 시점의 스냅샷이며 추후 변경될 수 있다.

| PR | 검토 시 병합 대상 | 상태 | 확인한 head 커밋 |
| --- | --- | --- | --- |
| [#20](https://github.com/istars8370/shah-cat/pull/20) | main | Draft / open | `76accb296d3e2d200b4457c36ea5b4270a3f66b6` |
| [#22](https://github.com/istars8370/shah-cat/pull/22) | feature/shah-wallet-v1-20261025 | Draft / open | `c05d3e1cabf2231900668e7cfc79b02d5055eea5` |
| [#23](https://github.com/istars8370/shah-cat/pull/23) | feature/shah-wallet-multichain-v1-1-20261025 | Draft / open | `59d7604ed10028c00e1773b1d558dfe687487f91` |
| [#26](https://github.com/istars8370/shah-cat/pull/26) | main | Draft / open | `e4c7745eff02a85943583272492c4f69463414fa` |
| [#50](https://github.com/istars8370/shah-cat/pull/50) | main | Draft / open | `f0897ee189354324030d67e9e684c1a06680271c` |
| [#53](https://github.com/istars8370/shah-cat/pull/53) | research/four-way-operations-checklist | Draft / open | `6857d17bc16bda38dbaa5e4c24c0f683a64005dc` |
| [#54](https://github.com/istars8370/shah-cat/pull/54) | research/four-way-architecture-reconcile | Draft / open | `f9ce989d2a97aa50653d5a30fbf82d0fa7b6fbe7` |
| [#55](https://github.com/istars8370/shah-cat/pull/55) | research/guardian-g1-state | Draft / open | `5a95d0c08c91866d9abd3fca67971609beddd80b` |
| [#56](https://github.com/istars8370/shah-cat/pull/56) | research/guardian-g2-design | Draft / open | `67dbd2b8e4a8120845528be4e80fbbad84ee6db3` |
| [#57](https://github.com/istars8370/shah-cat/pull/57) | research/guardian-g1-stable-pda | Draft / open | `db8df8a287dbf08fd6b365cbb79dcedaf715f679` |
| [#58](https://github.com/istars8370/shah-cat/pull/58) | research/guardian-g2-implementation | Draft / open | `dd510794dc08d06c5ca218d0ecfddf6b46052d81` |
| [#59](https://github.com/istars8370/shah-cat/pull/59) | research/guardian-g3-replay-timing | Draft / open | `90e98568bf4a5b77affd95b283e036804ef4c4df` |
| [#60](https://github.com/istars8370/shah-cat/pull/60) | research/devnet-d0-readonly | Draft / open | `954336bf18cb58da6447102abc44ffa1e97aae92` |
| [#63](https://github.com/istars8370/shah-cat/pull/63) | main | Draft / open | `c61c8e31be5c78a37d5ff3dcacbc226d9330331f` |

[PR #51](https://github.com/istars8370/shah-cat/pull/51)은 `research/four-way-operations-checklist`로 병합됐다. 확인한 head는 `4e4a994bb7ec8d1d7027c6d3a7fcd8baf593f4e8`이며 main에 실제 실행이 연결됐다는 증거로 사용하지 않는다. PR #58은 자금 보관·토큰 이동·Treasury·Falcon·배포를 추가하지 않는 시험 범위를 명시한다. PR #59는 읽기 전용이며 PR #60은 설계 전용이다.

[PR #63의 MVP 검토 문서](https://github.com/istars8370/shah-cat/blob/c61c8e31be5c78a37d5ff3dcacbc226d9330331f/docs/mvp-1-integration-gates.md)는 연구 격리, 최종 통합 후보 검사와 별도 Devnet 실험 승인을 제안한다. 본 경제 개정은 해당 기능을 자동 병합하거나 자금 실행 경로에 연결하지 않는다.

이번 작업은 경제 문서와 기존 백서 보존·탐색 링크의 변경이다. 프로그램 배포, 운영자 실제 서명, 실시간 잔액·권한, 유료 서비스 매출, 외부 감사·Mainnet·LP 집행은 수행하지 않았다.

## 검토 순서

1. v0.6의 고객·서비스 설명이 팀의 실제 개발 우선순위와 맞는지 확인한다.
2. 기존 권리·수량이 대시보드 산식과 일치하는지 검토한다.
3. 첫 서비스 카드와 실제 비용 자료를 채운다.
4. 동의·시행일을 기록하고, 필요한 구현 변경을 독립 PR로 검토한다.
5. 채택되지 않은 정책은 제안 상태로 보존한다. 임의로 배포 완료나 새로운 권리로 발표하지 않는다.

