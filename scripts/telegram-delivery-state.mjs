/**
 * Telegram delivery state machine. No network or file writes.
 * "unknown" is deliberately not retried automatically: Telegram may have
 * accepted the message before the client lost its response.
 */
export function transferKey(row) {
  const fields=["transaction_signature","sender_public_address","recipient_public_address","amount"];
  if (fields.some(field=>!String(row[field]??"").trim())) throw new Error("Incomplete transfer identity");
  return fields.map(field=>String(row[field])).join("|");
}

export function pendingTransfers(rows, state) {
  const seen=new Set();
  return rows.filter(row=>{
    const key=transferKey(row);
    if(seen.has(key)) return false;
    seen.add(key);
    return !Object.hasOwn(state,key);
  });
}

export function acceptedReceipt(receipt, chatId) {
  if(receipt?.ok!==true || !Number.isSafeInteger(receipt.result?.message_id) || receipt.result.message_id<=0) {
    throw new Error("Telegram acceptance receipt invalid");
  }
  if(!receipt.result.chat?.id) throw new Error("Telegram response chat identity missing");
  if(!String(chatId).startsWith("@") && String(receipt.result.chat.id)!==String(chatId)) {
    throw new Error("Telegram response chat mismatch");
  }
  return {status:"accepted",message_id:receipt.result.message_id,chat_id:String(receipt.result.chat.id)};
}

export function recordDelivery(state, row, outcome) {
  const key=transferKey(row);
  if(Object.hasOwn(state,key)) throw new Error("Delivery already recorded; manual review required");
  if(!["accepted","unknown","reserved"].includes(outcome?.status)) throw new Error("Invalid delivery outcome");
  if(outcome.status==="accepted" && (!outcome.message_id || !outcome.chat_id)) throw new Error("Missing accepted receipt");
  return {...state,[key]:outcome};
}

export function parseDeliveryState(text) {
  if(!text.trim()) return {};
  const value=JSON.parse(text);
  if(!value || Array.isArray(value) || typeof value!=="object") throw new Error("Invalid delivery state");
  for(const entry of Object.values(value)) {
    if(!entry || !["accepted","unknown","reserved"].includes(entry.status)) throw new Error("Invalid delivery record");
  }
  return value;
}

/**
 * Fail-closed reservation: persist this state BEFORE attempting sendMessage.
 * A crash after reservation must never trigger an automatic resend.
 * Operator reconciliation is required to resolve reserved/unknown entries.
 */
export function reserveTransfers(rows, state) {
  let next={...state};
  const reserved=[];
  for (const row of pendingTransfers(rows,next)) {
    const key=transferKey(row);
    next[key]={status:"reserved"};
    reserved.push(row);
  }
  return {state:next,rows:reserved};
}

export function resolveReservation(state, row, outcome) {
  const key=transferKey(row);
  if(state[key]?.status!=="reserved") throw new Error("No active delivery reservation");
  if(!["accepted","unknown"].includes(outcome?.status)) throw new Error("Invalid reservation outcome");
  if(outcome.status==="accepted" && (!outcome.message_id || !outcome.chat_id)) throw new Error("Missing accepted receipt");
  return {...state,[key]:outcome};
}
