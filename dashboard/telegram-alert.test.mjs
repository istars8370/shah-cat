import test from "node:test";
import assert from "node:assert/strict";
import { newTransfers, formatMessage, sendTelegram } from "../scripts/notify-telegram-ledger.mjs";

const header="timestamp_utc,network,token_symbol,mint,transfer_class,sender_role,sender_public_address,recipient_role,recipient_public_address,amount,transaction_signature,slot,status";
const row=(sig,amount="1")=>[
  "2026-10-24T03:32:16.000Z","devnet","SHAH","82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2",
  "development_or_other","Development","3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs",
  "Founder / Treasury","9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9",amount,sig,"1","confirmed"
].join(",");

test("newTransfers returns only signatures absent from previous ledger",()=>{
  const previous=header+"\n"+row("old")+"\n";
  const current=header+"\n"+row("old")+"\n"+row("new","2")+"\n";
  const result=newTransfers(previous,current);
  assert.equal(result.length,1);
  assert.equal(result[0].transaction_signature,"new");
  assert.equal(result[0].amount,"2");
});

test("Telegram message contains roles, amount and transaction signature",()=>{
  const current=header+"\n"+row("sig123","42")+"\n";
  const [entry]=newTransfers("",current);
  const message=formatMessage(entry);
  assert.match(message,/Development → Founder \/ Treasury/);
  assert.match(message,/42 SHAH/);
  assert.match(message,/sig123/);
});

test("missing Telegram secrets skips without network access",async()=>{
  let called=false;
  const result=await sendTelegram("test",async()=>{called=true; throw Error("unexpected");},"","");
  assert.equal(result.skipped,true);
  assert.equal(called,false);
});

test("Telegram API request uses POST JSON and requires a message acknowledgement",async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{calls.push({url,options}); return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
  const result=await sendTelegram("hello",fetcher,"123:TEST_TOKEN","@shahcatofficial");
  assert.equal(result.skipped,false);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/bot.*\/sendMessage$/);
  assert.equal(calls[0].options.method,"POST");
  assert.equal(JSON.parse(calls[0].options.body).chat_id,"@shahcatofficial");
});
