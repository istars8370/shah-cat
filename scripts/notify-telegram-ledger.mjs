#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createTelegramSender } from "./telegram-transport.mjs";

export function parseCsv(text) {
  const rows=[]; let row=[], cell="", quoted=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"' && quoted && text[i+1]==='"') { cell+='"'; i++; }
    else if (c==='"') quoted=!quoted;
    else if (c===',' && !quoted) { row.push(cell); cell=""; }
    else if ((c==='\n'||c==='\r') && !quoted) {
      if (c==='\r' && text[i+1]==='\n') i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row=[]; cell="";
    } else cell+=c;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const header=rows.shift();
  return rows.map(values => Object.fromEntries(header.map((key,i)=>[key,values[i]??""])));
}

export function newTransfers(previousText, currentText) {
  const previous = new Set(parseCsv(previousText || "").map(r=>r.transaction_signature).filter(Boolean));
  return parseCsv(currentText).filter(r => r.transaction_signature && !previous.has(r.transaction_signature));
}

export function formatMessage(row) {
  return [
    "🐈 SHAH CAT Devnet 거래 감지",
    "",
    `${row.sender_role || "Unknown"} → ${row.recipient_role || "Unknown"}`,
    `${row.amount || "0"} SHAH`,
    "",
    `UTC: ${row.timestamp_utc || "unknown"}`,
    `Tx: ${row.transaction_signature}`,
    "",
    "Devnet 테스트 기록 · 금전적 가치 없음",
  ].join("\n");
}

export async function sendTelegram(message, fetcher=fetch, token=process.env.TELEGRAM_BOT_TOKEN, chatId=process.env.TELEGRAM_CHAT_ID) {
  if (!token || !chatId) return { skipped:true, reason:"missing Telegram secrets" };
  await createTelegramSender({ token, chatId, fetchImpl: fetcher })(message);
  return { skipped:false };
}

export async function main() {
  const previousPath=process.argv[2];
  const currentPath=process.argv[3] || "docs/devnet-transfer-ledger-auto.csv";
  const previous=previousPath ? await readFile(previousPath,"utf8").catch(()=> "") : "";
  const current=await readFile(currentPath,"utf8");
  const rows=newTransfers(previous,current);
  if (!rows.length) { console.log("No new SHAH transfers to notify."); return; }
  for (const row of rows) {
    const result=await sendTelegram(formatMessage(row));
    if (result.skipped) {
      console.log("Telegram notification skipped:", result.reason);
      return;
    }
    console.log("Telegram notification sent for", row.transaction_signature);
  }
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{ console.error("Telegram alert failed:",error.message); process.exitCode=1; });
}
