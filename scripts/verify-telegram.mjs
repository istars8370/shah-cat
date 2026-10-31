#!/usr/bin/env node
import { pathToFileURL } from "node:url";

// Read-only metadata and permission checks. Does not post a message or typing status.
export async function verifyTelegram({
  token = process.env.TELEGRAM_BOT_TOKEN,
  chatId = process.env.TELEGRAM_CHAT_ID,
  expectedBot = process.env.TELEGRAM_EXPECTED_BOT,
  fetchImpl = fetch,
} = {}) {
  const username = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
  if (typeof token !== "string" || !/^[0-9]+:[A-Za-z0-9_-]+$/.test(token) ||
      typeof chatId !== "string" || !/^(?:-?[1-9][0-9]*|@[A-Za-z][A-Za-z0-9_]{4,31})$/.test(chatId)) {
    throw Error("Valid TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.");
  }
  if (expectedBot !== undefined && (typeof expectedBot !== "string" || !username.test(expectedBot.replace(/^@/, "")))) {
    throw Error("Invalid TELEGRAM_EXPECTED_BOT.");
  }
  const api = async (method, body) => {
    let response, payload;
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      payload = await response.json();
    } catch {
      // fetch errors can include token-bearing URLs; never echo external error text.
      throw Error("Telegram metadata request failed (network or response format).");
    }
    if (!response.ok || payload?.ok !== true || !payload.result || typeof payload.result !== "object" || Array.isArray(payload.result)) {
      throw Error("Telegram metadata request was rejected or returned an invalid result.");
    }
    return payload.result;
  };
  const me = await api("getMe", {});
  if (!Number.isSafeInteger(me.id) || me.id <= 0 || me.is_bot !== true || !username.test(me.username || "")) {
    throw Error("Invalid Telegram bot identity.");
  }
  if (expectedBot !== undefined && me.username.toLowerCase() !== expectedBot.replace(/^@/, "").toLowerCase()) {
    throw Error("Telegram bot identity does not match TELEGRAM_EXPECTED_BOT.");
  }
  const chat = await api("getChat", { chat_id: chatId });
  if (!Number.isSafeInteger(chat.id) || chat.id === 0 ||
      (chatId.startsWith("@") ? ("@" + chat.username).toLowerCase() !== chatId.toLowerCase() : String(chat.id) !== chatId)) {
    throw Error("Telegram destination identity mismatch.");
  }
  if (chat.type === "channel") {
    if (chat.id >= 0) throw Error("Invalid Telegram channel identity.");
    const member = await api("getChatMember", { chat_id: chat.id, user_id: me.id });
    if (member.user?.id !== me.id || member.user?.is_bot !== true ||
        member.status !== "administrator" || member.can_post_messages !== true) {
      throw Error("Bot must be a channel administrator with message posting permission.");
    }
    return { bot: me.username, chatId: chat.id, type: "channel", canPost: true, deliveryTested: false };
  }
  if (chat.type === "private" && chat.id > 0 && !chatId.startsWith("@")) {
    return { bot: me.username, chatId: chat.id, type: "private", canPost: null, deliveryTested: false };
  }
  throw Error("Only a numeric private chat or an official channel is supported by this preflight.");
}

export async function main() {
  const result = await verifyTelegram();
  console.log("Telegram metadata preflight passed for bot @" + result.bot + "; destination: " + result.type);
  console.log(result.canPost === true ? "Channel posting permission verified; no message sent." : "Private chat metadata verified; delivery remains untested.");
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error("Telegram preflight failed:", error.message); process.exitCode = 1; });
}
