#!/usr/bin/env node
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
  console.error("Telegram secrets are missing.");
  process.exit(1);
}

async function api(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(`${method} failed with HTTP ${response.status}`);
  }
  return payload.result;
}

try {
  const me = await api("getMe", {});
  await api("sendChatAction", { chat_id: chatId, action: "typing" });
  console.log("Telegram preflight passed for bot @" + (me.username || "unknown"));
} catch (error) {
  console.error("Telegram preflight failed:", error.message);
  process.exit(1);
}
