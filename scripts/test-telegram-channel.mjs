#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { verifyTelegram } from "./verify-telegram.mjs";
import { createTelegramSender } from "./telegram-transport.mjs";

export const CHANNEL = "@shahcatofficial";
export const BOT = "shahcat_istars8370_bot";
const MESSAGE = [
  "🐈 SHAH CAT 공식 채널 알림 연결 테스트",
  "Solana Devnet 알림 연결을 확인하는 테스트 메시지입니다.",
  "실제 거래 감지·토큰 전송·Mainnet 출시를 의미하지 않습니다.",
].join("\n");

export async function testTelegramChannel({
  send = false, token = process.env.TELEGRAM_BOT_TOKEN,
  chatId = process.env.TELEGRAM_CHAT_ID,
  verify = verifyTelegram, senderFactory = createTelegramSender,
} = {}) {
  if (typeof send !== "boolean") throw Error("send must be an explicit boolean");
  if (typeof chatId !== "string" || chatId.toLowerCase() !== CHANNEL) {
    throw Error("Set TELEGRAM_CHAT_ID to the approved official channel " + CHANNEL);
  }
  const checked = await verify({ token, chatId, expectedBot: BOT });
  if (checked.bot !== BOT || checked.type !== "channel" || checked.canPost !== true ||
      !Number.isSafeInteger(checked.chatId) || checked.chatId >= 0) {
    throw Error("Official channel bot identity or posting permission was not verified");
  }
  if (!send) return { channel: CHANNEL, bot: BOT, permissionsVerified: true, sent: false };
  // Use the inspected numeric destination so a username reassignment cannot redirect the send.
  const sender = senderFactory({ token, chatId: String(checked.chatId) });
  await sender(MESSAGE);
  return { channel: CHANNEL, bot: BOT, permissionsVerified: true, sent: true };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--send")) {
    throw Error("Usage: node scripts/test-telegram-channel.mjs [--send]");
  }
  const result = await testTelegramChannel({ send: args[0] === "--send" });
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error("Official channel test failed:", error.message); process.exitCode = 1; });
}
