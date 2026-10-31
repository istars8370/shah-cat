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
  const chat = await api("getChat", { chat_id: chatId });
  if (String(chat.id) !== String(chatId) && !String(chatId).startsWith("@")) throw new Error("Telegram chat identity mismatch");
  if (chat.type === "channel" || chat.type === "supergroup") {
    const member = await api("getChatMember", { chat_id: chatId, user_id: me.id });
    if (!["administrator", "creator"].includes(member.status)) throw new Error("Bot is not an administrator");
    if (chat.type === "channel" && member.status !== "creator" && member.can_post_messages !== true) throw new Error("Bot cannot post to channel");
  }
  console.log("Telegram preflight passed for bot @" + (me.username || "unknown"));
} catch (error) {
  console.error("Telegram preflight failed:", error.message);
  process.exit(1);
}
