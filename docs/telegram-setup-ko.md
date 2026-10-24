# SHAH CAT 텔레그램 개인 알림 연결

## 현재 범위
- SHAH CAT은 Solana **Devnet 테스트 토큰**입니다. 메인넷 및 실제 매수·매도 알림이 아닙니다.
- 개인 알림 봇: `@shahcat_istars8370_bot` / 알림 수신 계정: `@istars8370`
- 기존 `scripts/sync-devnet-ledger.mjs`와 `scripts/notify-telegram-ledger.mjs`를 사용합니다.
- 현재 예약 작업은 하루 한 번 UTC 00:17(한국시간 09:17)에 실행됩니다. 거래 즉시 알림이 아니며 지정된 일부 지갑의 전송만 감시합니다.

## 1. 봇 토큰 교체
과거 텔레그램 캡처에 토큰이 노출되었으므로 BotFather `/mybots` > SHAH CAT 봇 > API Token > **Revoke current token**으로 기존 비밀번호를 무효화하고 새 토큰을 받습니다. 봇 자체는 삭제되지 않습니다. 이전에 노출된 다른 봇 토큰도 각각 교체하세요.

**새 토큰을 채팅/이미지/커밋에 입력하지 마세요.**

## 2. Chat ID 확인 및 PC에서 테스트
1. 텔레그램 `@istars8370` 계정에서 `@shahcat_istars8370_bot`을 열고 **시작**을 누른 뒤 `/id` 전송
2. 제공된 `SHAH_CAT_Telegram_Setup.zip` 압축 해제 후 `Start-SHAH-CAT-Telegram.cmd` 실행
3. 새 토큰을 입력(입력 화면에는 표시되지 않음)
4. 안내에 따라 `/id` 전송 확인 및 Chat ID 출력
5. 같은 계정의 텔레그램 DM으로 테스트 메시지가 실제 도착했는지 확인

이 설정 도구는 공식 Telegram Bot API와만 통신합니다. 토큰을 파일에 저장하지 않습니다.

## 3. GitHub Actions Secrets 등록
저장소 관리자 권한으로 https://github.com/istars8370/shah-cat/settings/secrets/actions 접속해 **Settings → Secrets and variables → Actions → New repository secret**으로 아래 두 개를 추가합니다.

- `TELEGRAM_BOT_TOKEN` : 새 BotFather API 토큰
- `TELEGRAM_CHAT_ID` : 위 도구로 확인된 숫자

Secrets는 GitHub 저장소의 암호화된 설정에 저장합니다. 일반 Variables나 소스코드로 저장하지 마세요.

## 4. GitHub에서 연결 검증
본 PR이 main에 병합된 뒤 `Actions` > **SHAH CAT Telegram Message Test** > **Run workflow** 를 실행합니다.
이 과정은 네트워크에서 새 거래가 없어도 테스트 메시지를 보냅니다.

기존 `SHAH CAT Devnet Ledger Sync` 워크플로를 수동 실행하면 테스트넷 일부 지갑 거래 감시를 실행합니다. 예약 실행은 GitHub 환경에 따라 지연될 수 있습니다. 현재 구성은 24시간 실시간 감시가 아닙니다.

## 보안
- 봇 토큰 외에도 지갑 복구문구, 개인키를 요청하지 않습니다.
- 오작동 시 GitHub Actions의 개별 실행 결과에서 실패 단계만 확인하고, 토큰은 공유하지 마세요.
