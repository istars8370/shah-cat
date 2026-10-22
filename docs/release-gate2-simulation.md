# SHAH CAT Gate 2B — Devnet 수신 ATA·실제 수수료·서명 없는 시뮬레이션

**초안 / 검토 전용 / 실제 토큰 전송 불가 / Mainnet 미승인**

이 PR은 `GET /api/quote?sender=...&recipient=...&amount=...`와 대시보드 조회 버튼을 추가합니다.

1. Devnet Genesis Hash와 입력값·잔액을 다시 확인합니다.
2. SHAH Mint가 기존 SPL Token Program 소유인지 확인하고, 수신 지갑의 canonical ATA를 PDA 방식으로 계산합니다.
3. 기존 ATA가 있으면 owner·mint·상태·정밀도를 검증하고, 없으면 CreateIdempotent ATA instruction을 **시뮬레이션에만** 포함합니다.
4. 최신 블록해시와 legacy SPL TransferChecked 메시지로 RPC `getFeeForMessage`를 조회합니다.
5. ATA가 없으면 RPC `getMinimumBalanceForRentExemption(165)`으로 환급 가능한 계정 임대 예치금을 별도 표시합니다.
6. 유효 서명이 없는 제로 시그니처 메시지로 RPC `simulateTransaction`을 호출합니다. **서명·브로드캐스트·키 관리 기능은 없습니다.**

보안 경계: Token-2022와 토큰 확장, PDA 수신자, 다중서명, 우선순위 수수료는 지원하지 않습니다. Fee·rent·balance·simulation은 시점이 다른 스냅샷이며 미래 송금을 보장하지 않습니다. 서버에서 unsigned message를 만든 뒤 조회만 수행하고, 메시지 원본을 브라우저로 반환하지 않습니다.

**로컬 교차 검증 (2026-10-22):** 공식 Solana SDK로 생성한 고정 벡터와 곡선 판정 69개, ATA 주소 38개, 기존/신규 ATA 및 수량 경계값의 메시지 6개를 비교했습니다. 신규 13개를 포함한 전체 122개 로컬 테스트가 통과했습니다. 현재 로컬 변경 사항의 GitHub CI 결과는 미검증입니다. SDK 기본 계정 순서가 아닌 명시한 유효 순서로 직렬화한 비교이며, 모든 암호학적 입력이나 실제 거래 성공을 보증하지 않습니다. [재현 방법과 SDK 개발 의존성 위험](../tools/sdk-reference/README.md)을 확인하세요. 프로덕션·Mainnet 준비 확인이 아닙니다.

검증 명령: `node --test dashboard/*.test.mjs`
Windows CMD 테스트 서버: `set PORT=4181` 다음 `node dashboard/server.mjs`
접속: `http://127.0.0.1:4181` 에서 Phantom 연결 후 1 SHAH 등 적은 수량으로 읽기 전용 버튼 확인.

**절대 실행하지 않는 작업:** Phantom 서명, sendTransaction, sendRawTransaction, 실제 Devnet 전송, Mainnet 배포, 토큰 권한 변경.

병합은 별도 사용자 승인 후 진행합니다.
