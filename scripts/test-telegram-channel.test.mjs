import test from "node:test";
import assert from "node:assert/strict";
import { testTelegramChannel, main, CHANNEL, BOT } from "./test-telegram-channel.mjs";

function fixture() {
  const calls = [];
  const checked = { bot: BOT, type: "channel", canPost: true, chatId: -100123 };
  const options = {
    token: "123:FAKE", chatId: CHANNEL,
    verify: async config => { calls.push({ verify: config }); return checked; },
    senderFactory: config => { calls.push({ sender: config }); return async text => { calls.push({ message: text }); }; },
  };
  return { calls, checked, options };
}

test("default official channel check never constructs a sender or sends a message", async () => {
  const { calls, options } = fixture();
  assert.deepEqual(await testTelegramChannel(options), {
    channel: CHANNEL, bot: BOT, permissionsVerified: true, sent: false,
  });
  assert.deepEqual(calls, [{ verify: { token: "123:FAKE", chatId: CHANNEL, expectedBot: BOT } }]);
});

test("explicit send verifies first, targets the inspected numeric ID and sends exactly one test", async () => {
  const { calls, options } = fixture();
  assert.equal((await testTelegramChannel({ ...options, send: true })).sent, true);
  assert.equal(calls.length, 3);
  assert.ok(calls[0].verify);
  assert.deepEqual(calls[1].sender, { token: "123:FAKE", chatId: "-100123" });
  assert.match(calls[2].message, /테스트 메시지/);
  assert.match(calls[2].message, /실제 거래 감지·토큰 전송·Mainnet 출시를 의미하지 않습니다/);
});

test("private or different destinations and ambiguous send values fail before API calls", async () => {
  const { calls, options } = fixture();
  for (const chatId of ["@istars8370", "123", "@anotherchannel", undefined]) {
    await assert.rejects(testTelegramChannel({ ...options, chatId }), /official channel/);
  }
  await assert.rejects(testTelegramChannel({ ...options, send: "false" }), /boolean/);
  assert.equal(calls.length, 0);
});

test("wrong bot, missing permission and invalid channel result cannot send", async () => {
  for (const change of [{ bot: "another_bot" }, { canPost: false }, { type: "private" },
    { chatId: 123 }, { chatId: "-100123" }]) {
    const { checked, calls, options } = fixture();
    Object.assign(checked, change);
    await assert.rejects(testTelegramChannel({ ...options, send: true }), /was not verified/);
    assert.equal(calls.length, 1);
  }
});

test("failed permission check never sends; uncertain delivery is not retried", async () => {
  const { options } = fixture();
  let sends = 0;
  const senderFactory = () => async () => { sends++; throw Error("delivery outcome unknown"); };
  await assert.rejects(testTelegramChannel({ ...options, send: true, senderFactory,
    verify: async () => { throw Error("permission denied"); } }), /permission denied/);
  assert.equal(sends, 0);
  await assert.rejects(testTelegramChannel({ ...options, send: true, senderFactory }), /outcome unknown/);
  assert.equal(sends, 1);
});

test("CLI rejects all unknown options and extra arguments before reading credentials", async () => {
  for (const args of [["--check"], ["--send", "--send"], ["--send=true"]]) {
    await assert.rejects(main(args), /Usage/);
  }
});
