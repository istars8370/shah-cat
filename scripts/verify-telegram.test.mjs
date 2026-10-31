import test from "node:test";
import assert from "node:assert/strict";
import { verifyTelegram } from "./verify-telegram.mjs";

const bot = { id: 123, is_bot: true, username: "shahcat_istars8370_bot" };
const channel = { id: -100123, type: "channel", username: "shahcatofficial" };
const admin = { status: "administrator", user: bot, can_post_messages: true };
function setup(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const method = url.split("/").at(-1);
    assert.ok(["getMe", "getChat", "getChatMember"].includes(method), "Read-only methods only");
    assert.equal(options.redirect, "error");
    calls.push({ method, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ ok: true, result: Object.hasOwn(overrides, method)
      ? overrides[method] : { getMe: bot, getChat: channel, getChatMember: admin }[method] }) };
  };
  return { calls, options: { token: "123:TEST_TOKEN", chatId: "@shahcatofficial", fetchImpl } };
}

test("channel uses read-only identity and posting permission checks, never typing or messages", async () => {
  const { calls, options } = setup();
  assert.deepEqual(await verifyTelegram({ ...options, expectedBot: "@shahcat_istars8370_bot" }), {
    bot: bot.username, chatId: channel.id, type: "channel", canPost: true, deliveryTested: false,
  });
  assert.deepEqual(calls, [{ method: "getMe", body: {} }, { method: "getChat", body: { chat_id: "@shahcatofficial" } },
    { method: "getChatMember", body: { chat_id: channel.id, user_id: bot.id } }]);
});

test("channel with missing or false posting permission is rejected", async () => {
  for (const can_post_messages of [undefined, false, "true"]) {
    const { options } = setup({ getChatMember: { ...admin, can_post_messages } });
    await assert.rejects(verifyTelegram(options), /posting permission/);
  }
});

test("ordinary member, restricted, left or banned bot is rejected", async () => {
  for (const status of ["member", "restricted", "left", "kicked"]) {
    const { options } = setup({ getChatMember: { ...admin, status } });
    await assert.rejects(verifyTelegram(options), /administrator/);
  }
});

test("wrong bot identity or wrong member response cannot pass", async () => {
  const { options, calls } = setup();
  await assert.rejects(verifyTelegram({ ...options, expectedBot: "another_bot" }), /identity does not match/);
  assert.equal(calls.length, 1);
  const wrong = setup({ getChatMember: { ...admin, user: { ...bot, id: 456 } } });
  await assert.rejects(verifyTelegram(wrong.options), /administrator/);
});

test("destination username and numeric ID must match getChat", async () => {
  const { options } = setup({ getChat: { ...channel, username: "anotherchannel" } });
  await assert.rejects(verifyTelegram(options), /destination identity mismatch/i);
  const numeric = setup();
  await assert.rejects(verifyTelegram({ ...numeric.options, chatId: "-100456" }), /destination identity mismatch/i);
  assert.equal((await verifyTelegram({ ...numeric.options, chatId: "-100123" })).canPost, true);
});

test("numeric private destination stays read-only and does not claim verified delivery", async () => {
  const { options, calls } = setup({ getChat: { id: 789, type: "private" } });
  const result = await verifyTelegram({ ...options, chatId: "789" });
  assert.equal(result.canPost, null);
  assert.equal(result.deliveryTested, false);
  assert.deepEqual(calls.map(x => x.method), ["getMe", "getChat"]);
});

test("personal username, unsupported groups and malformed metadata fail closed", async () => {
  for (const getChat of [{ id: -100123, type: "supergroup", username: "shahcatofficial" },
    { id: 789, type: "private", username: "shahcatofficial" }, { ...channel, id: 0 }, {}]) {
    const { options } = setup({ getChat });
    await assert.rejects(verifyTelegram(options));
  }
  for (const getMe of [{ ...bot, is_bot: false }, { ...bot, id: "123" }, {}, null]) {
    await assert.rejects(verifyTelegram(setup({ getMe }).options));
  }
});

test("invalid configuration fails before any network call", async () => {
  const { options, calls } = setup();
  for (const invalid of [{ token: "" }, { token: "123:SECRET\n" }, { chatId: "personal name" },
    { expectedBot: "" }, { chatId: "" }]) {
    await assert.rejects(verifyTelegram({ ...options, ...invalid }));
  }
  assert.equal(calls.length, 0);
});

test("network, malformed JSON and Telegram errors never echo secrets", async () => {
  const cases = [async () => { throw Error("https://api.telegram.org/bot123:SECRET/getMe"); },
    async () => ({ ok: true, json: async () => { throw Error("SECRET"); } }),
    async () => ({ ok: false, json: async () => ({ ok: false, description: "SECRET" }) }),
    async () => ({ ok: true, json: async () => ({ ok: true, result: [] }) })];
  for (const fetchImpl of cases) {
    await assert.rejects(verifyTelegram({ ...setup().options, fetchImpl }), error => {
      assert.doesNotMatch(error.message, /SECRET|api\.telegram/);
      return true;
    });
  }
});
