# SHAH CAT 로컬 대시보드 실행 (Windows)

## 준비
- Node.js 20 이상 (권장 LTS)
- 인터넷 연결
- Solana Devnet 공개 RPC 접근

## 처음 설치
1. [SHAH CAT GitHub 저장소](https://github.com/istars8370/shah-cat)에 접속합니다.
2. 녹색 **Code** → **Download ZIP**을 클릭합니다.
3. 내려받은 `shah-cat-main.zip` 파일을 마우스 오른쪽 버튼으로 클릭하여 **압축 풀기** 합니다.
4. 압축을 푼 폴더의 `dashboard` 폴더로 이동합니다.
5. 파일 탐색기 주소창에 `cmd`를 입력하고 Enter를 누릅니다.
6. 다음 명령을 입력합니다.

```cmd
node server.mjs
```

7. 명령 프롬프트에 `SHAH CAT Dashboard: http://127.0.0.1:4173`가 나타나면 브라우저에서 다음 주소를 엽니다.

**http://127.0.0.1:4173**

## 기능
- SHAH CAT Devnet 발행량 실시간 조회
- 개발 지갑 / SHAH Treasury 공개 잔액 조회
- Mint Authority / Freeze Authority 실시간 조회
- Metadata Update Authority / isMutable은 2026-10-21 점검 기록으로 표시 (실시간 아님)
- `docs/devnet-transfer-log.csv` 장부 표시
- 새로고침 버튼
- **배분·베스팅**: v0.5 월별 해제 미리보기, 입력한 개인별 Devnet 주소의 목표량·현재 잔액 대조, 조회 결과 CSV

[배분 대조와 베스팅 조회 안내](tokenomics-dashboard.md)를 참고하세요. T0와 실제 잠금은 미검증이며, 잔액 차이를 기지급량이나 추가 송금 필요량으로 사용하지 않습니다.

## 주의
- 이 프로그램은 개인키를 사용하지 않는 **읽기 전용** 대시보드입니다.
- 명령 프롬프트를 닫으면 로컬 서버가 종료됩니다.
- 대시보드는 자동으로 공개 인터넷에 배포되지 않습니다. 본인 PC의 `127.0.0.1`에서만 접속됩니다.
- Solana Devnet 공개 RPC는 혼잡할 때 실패할 수 있습니다. 이 경우 잠시 후 새로고침하세요.
- 장부는 GitHub CSV의 다운로드 시점 복사본을 보여줍니다. GitHub 원본을 수정한 후에는 ZIP을 다시 받아야 변경 사항이 반영됩니다.
- 이 코드는 GitHub에 저장되어 있지만 사용자 PC에서의 실제 실행은 별도로 확인해야 합니다.
