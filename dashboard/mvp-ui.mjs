import { createMonoRunSession } from "./mono-run.mjs";

// A contract exerciser, not a shipped game or reward service. Guest data stays in memory.
const start = document.getElementById("monoStart");
const finish = document.getElementById("monoFinish");
const output = document.getElementById("monoStatus");
let session;
start.addEventListener("click", () => {
  session?.dispose();
  session = createMonoRunSession(crypto.randomUUID());
  finish.disabled = false;
  output.textContent = "게스트 세션 준비 완료 · 샘플 결과를 받아 연동을 확인할 수 있습니다.";
});
finish.addEventListener("click", () => {
  if (!session) return;
  const result = session.finish({ version: 1, sessionId: session.context.sessionId,
    score: 120, durationMs: 30000 });
  output.textContent = "샘플 결과: " + result.score + "점 / " + result.durationMs / 1000 +
    "초 · 검증되지 않은 예시 · 보상 없음 · 서버 저장 없음";
  finish.disabled = true;
});
window.addEventListener("pagehide", () => { session?.dispose(); session = null; finish.disabled = true; });
