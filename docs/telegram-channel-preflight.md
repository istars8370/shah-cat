# 공식 채널 Telegram 사전 검증

2026-10-26 로컬 검토본 변경. `scripts/verify-telegram.mjs`는 `getMe` → `getChat` → 채널의 `getChatMember`를 호출한다. `sendChatAction`은 공식 API에서 채널을 지원하지 않으므로 검증에 사용하지 않는다. 메시지·입력 중 표시·권한 변경은 발생하지 않는다.

## 선택된 구성

- 알림 봇: `@shahcat_istars8370_bot`
- 공개 수신 채널: `@shahcatofficial`
- 개인 관리자 계정 `@istars8370`은 채널 수신 대상이 아니다.

기존 `telegram-setup-ko.md`의 개인 DM 절차와 구분한다. 채널에서는 봇을 관리자로 추가하고 메시지 게시 권한을 부여해야 한다. 검증기는 실제 반환된 봇 ID와 채널 멤버 ID의 일치, 관리자 상태, `can_post_messages === true`를 확인한다. 채널 username 또는 숫자 ID가 요청 대상과 다르면 중단한다. 개인 채팅은 숫자 ID만 허용하고, 메타데이터 조회 성공을 발송 성공으로 표시하지 않는다. 그룹·슈퍼그룹은 이 검증기의 지원 범위 밖이다.

## 로컬 실행

기존 `.env.telegram`에는 봇 토큰과 채널 ID를 저장한다. 이 파일은 Git에 포함하지 않는다. `TELEGRAM_EXPECTED_BOT=shahcat_istars8370_bot`을 추가하면 실수로 다른 봇 토큰을 사용한 경우도 차단한다.

검토본에서 기존 설정 파일을 지정해 읽기 전용 검증만 실행한다.

```powershell
node --env-file=../shah-cat-wallet-hardening/.env.telegram scripts/verify-telegram.mjs
```

토큰 값이 없으면 외부 요청 전에 실패한다. 토큰을 출력하거나 Telegram의 오류 설명·요청 URL을 로그에 기록하지 않는다. 정상 종료해도 실제 발송·수신 완료 증거는 아니다. 봇 권한은 검사 후 바뀔 수 있으며, 발송 직전에 다시 검사해야 한다.

GitHub Actions의 `TELEGRAM_CHAT_ID`는 로컬 파일과 별개 설정이다. 로컬 채널 선택이 저장소 Secrets의 변경을 의미하지 않는다. 기존 예약 작업이나 테스트 워크플로를 임의 실행하지 않았다. 이번 변경은 검토본에만 있으며 원격 main 반영·배포는 별도 단계다.

## 검증

```powershell
node --test scripts/verify-telegram.test.mjs
```

9개 모의 테스트: 읽기 메서드 제한, 관리자·게시 권한, 봇·수신 대상 식별, 개인 채팅 한계, 잘못된 설정·응답, 토큰 노출 방지. 실제 API 검증은 토큰이 준비된 환경에서 수행한다.

공식 근거: [sendChatAction의 채널 제외](https://core.telegram.org/bots/api#sendchataction), [getChatMember](https://core.telegram.org/bots/api#getchatmember), [채널 관리자 게시 권한](https://core.telegram.org/bots/api#chatmemberadministrator).

## 2026-10-27 발송 경로 통합

수동 `telegram-test.yml`도 메시지 발송 전에 위 사전 검증을 실행한다. 공식 채널 테스트이므로 단계 이름에서 개인 DM이라는 표현을 제거했다. 워크플로는 실행하지 않았으며 저장소 Secrets도 변경하지 않았다.

`telegram-transport.mjs`로 발송 코드만 분리해 수동 테스트의 기존 `sendTelegram`과 새 장부의 `createTelegramSender`가 같은 전송 검증을 사용한다. 기존 수동 CSV 처리나 장부 데이터 형식은 변경하지 않는다. 전송 모듈은 장부 수집기·지갑 코드에 의존하지 않는다. 기존 `telegram-alerts.mjs`의 export는 유지해 호출자 호환성을 보존한다.

이제 HTTP 성공과 `ok: true`만으로 발송 성공을 판정하지 않고 양의 정수 `result.message_id`까지 검사한다. 네트워크 오류·잘못된 JSON·API 설명에서 토큰이나 URL이 로그에 섞이지 않도록 처리하며, 리디렉션을 거부하고 429의 `retry_after`를 전달한다. 빈 메시지와 4096자 초과 메시지, 잘못된 자격 증명은 전송 전에 거부한다. timeout·불완전한 응답은 실제 발송 여부가 불명확하므로 수신 채널을 확인한 뒤 재시도한다. 정확히 한 번 발송을 보장하지 않는다.

추가 테스트:

```powershell
node --test --test-isolation=none scripts/telegram-transport.test.mjs scripts/telegram-alerts.test.mjs scripts/verify-telegram.test.mjs dashboard/telegram-alert.test.mjs
```

## 2026-10-28 공식 채널 단일 실행 명령

`scripts/test-telegram-channel.mjs`는 승인된 봇 `shahcat_istars8370_bot`과 채널 `@shahcatofficial`을 고정해서 검사한다. 다른 봇 토큰·개인 DM·다른 채널 설정으로는 테스트 메시지를 보내지 않는다. 환경변수의 `TELEGRAM_EXPECTED_BOT`을 잘못 바꿔도 이 명령의 고정된 봇 검사에는 영향을 주지 않는다.

검토본 루트에서 실행:

```powershell
# 읽기 전용: 봇 신원·채널·게시 권한 확인만 수행
node --env-file=../shah-cat-wallet-hardening/.env.telegram scripts/test-telegram-channel.mjs

# 실제 공개 발송: 위 검사 통과 후 테스트 메시지 한 건 게시
node --env-file=../shah-cat-wallet-hardening/.env.telegram scripts/test-telegram-channel.mjs --send
```

권한 조회에서 확인한 채널의 숫자 ID로 발송한다. 발송 사이에 username의 대상이 바뀌어도 다른 채널로 전송하지 않는다. `sent: true`는 Telegram API가 양의 정수 message ID로 응답했음을 의미하며, 모든 구독자의 수신·읽음 증거는 아니다. 실제 거래가 감지됐다는 오해를 피하도록 메시지에 연결 테스트라고 명시했다. 자동 재시도와 예약 실행은 없다.

수동 GitHub 테스트 워크플로도 이 명령에 `--send`를 전달한다. 기존 저장소 Secret이 개인 DM ID라면 명시적으로 실패한다. 공식 채널을 사용할 때는 운영자가 `TELEGRAM_CHAT_ID` Secret을 `@shahcatofficial`로 설정해야 한다. 로컬 파일 저장만으로 GitHub Secrets가 갱신되지는 않는다.

신규 모의 테스트 6개는 기본 실행 무발송, 고정 봇·채널 확인, 숫자 대상에 한 건 발송, 검사 실패 시 무발송, 불명확한 발송 결과 무재시도, CLI 옵션 검증을 다룬다. 토큰이 비어 있는 로컬 구성에서는 외부 요청 전에 실패하는 것을 확인했으며 실제 메시지는 발송하지 않았다.

## 분리 검토본 기준

이 패치는 main `9d9734ed98e33d696545f91b5f2c3af9f31ee495` 기준의 Telegram 전용 변경이다. 장부 수집기·대시보드 API·지갑·SDK·Four-Way 연구 코드를 포함하지 않는다.

설정 파일 경로는 실제 로컬 위치를 사용한다. 예: `node --env-file=C:/Users/01025258370/Desktop/shah-cat-test/shah-cat-wallet-hardening/.env.telegram scripts/test-telegram-channel.mjs`. 실제 발송하려면 별도로 `--send`를 지정한다. 원격 CI·실제 발송은 수행하지 않았다.
