import test from "node:test";
import assert from "node:assert/strict";
import { sendTelegram } from "./notify-telegram-ledger.mjs";
import { createTelegramSender } from "./telegram-transport.mjs";

const token = "123:TEST_SECRET";
const chatId = "@shahcatofficial";
const response = (body, status = 200) => async () => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
});

test("legacy manual-test sender rejects malformed success replies", async () => {
  for (const body of [null, {}, { ok: "true", result: { message_id: 1 } },
    { ok: true }, { ok: true, result: { message_id: "1" } },
    { ok: true, result: { message_id: 0 } }, { ok: true, result: { message_id: -1 } }]) {
    await assert.rejects(sendTelegram("test", response(body), token, chatId), /acknowledgement/);
  }
});

test("legacy sender redacts transport URLs, malformed JSON and API descriptions", async () => {
  const fetchers = [async () => { throw Error("https://api.telegram.org/bot" + token + "/sendMessage"); },
    async () => ({ ok: true, json: async () => { throw Error(token); } }),
    response({ ok: false, description: token }, 403)];
  for (const fetcher of fetchers) {
    await assert.rejects(sendTelegram("test", fetcher, token, chatId), error => {
      assert.doesNotMatch(error.message, /TEST_SECRET|api\.telegram/);
      return true;
    });
  }
});

test("HTTP failure and rate limit cannot be reported as acknowledged sends", async () => {
  await assert.rejects(sendTelegram("test", response({ ok: true, result: { message_id: 1 } }, 500), token, chatId));
  let calls = 0;
  const limited = async () => { calls++; return response({ ok: false, parameters: { retry_after: 20 } }, 429)(); };
  await assert.rejects(sendTelegram("test", limited, token, chatId), error => error.retryAfter === 20);
  assert.equal(calls, 1, "no automatic retry after an external side effect");
});

test("invalid message or configured credentials fail before network access", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error("must not fetch"); };
  const send = createTelegramSender({ token, chatId, fetchImpl });
  for (const value of [null, 5, "", "   ", "a".repeat(4097)]) await assert.rejects(send(value));
  for (const [badToken, badChat] of [["malformed", chatId], [token, "personal name"]]) {
    await assert.rejects(sendTelegram("test", fetchImpl, badToken, badChat));
  }
  assert.equal(calls, 0);
});

test("legacy successful call retains its return shape and disables redirects and previews", async () => {
  const result = await sendTelegram("안내 <plain text>", async (url, options) => {
    assert.equal(url, "https://api.telegram.org/bot" + token + "/sendMessage");
    assert.equal(options.redirect, "error");
    assert.deepEqual(JSON.parse(options.body), { chat_id: chatId, text: "안내 <plain text>",
      link_preview_options: { is_disabled: true } });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 12 } }) };
  }, token, chatId);
  assert.deepEqual(result, { skipped: false });
});
