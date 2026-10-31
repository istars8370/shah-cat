// Shared Telegram transport. Contains no wallet, ledger, signing or broadcast imports.
export function createTelegramSender({ token, chatId, fetchImpl = fetch }) {
  if (typeof token !== "string" || !/^[0-9]+:[A-Za-z0-9_-]+$/.test(token) ||
      typeof chatId !== "string" || !/^(?:-?[1-9][0-9]*|@[A-Za-z][A-Za-z0-9_]{4,31})$/.test(chatId)) {
    throw Error("Valid Telegram bot token and chat ID are required");
  }
  return async text => {
    if (typeof text !== "string" || !text.trim() || text.length > 4096) {
      throw Error("Telegram message must contain 1–4096 characters");
    }
    let response, body;
    try {
      response = await fetchImpl("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST", redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(15000),
      });
      body = await response.json();
    } catch {
      throw Error("Telegram delivery outcome unknown; inspect destination before retrying");
    }
    if (!response.ok || body?.ok !== true || !Number.isSafeInteger(body?.result?.message_id) || body.result.message_id <= 0) {
      const delay = body?.parameters?.retry_after;
      const error = Error(response.status === 429 && Number.isSafeInteger(delay) && delay > 0
        ? "Telegram rate limit; retry after " + delay + " seconds"
        : "Telegram rejected delivery or returned an invalid acknowledgement");
      if (response.status === 429 && Number.isSafeInteger(delay) && delay > 0) error.retryAfter = delay;
      throw error;
    }
  };
}
