import {deliverReservedTransfer} from "./telegram-delivery-coordinator.mjs";
import {acceptedReceipt} from "./telegram-delivery-state.mjs";
import {formatMessage} from "./notify-telegram-ledger.mjs";

/**
 * Adapter for an injected Telegram transport. No live API call is performed
 * unless a caller explicitly supplies a transport and invokes this function.
 * Not imported by the scheduled workflow.
 */
export async function deliverTelegramRow(row,{read,publish,transport,chatId}) {
  if(typeof transport!=="function") throw new Error("Telegram transport must be injected");
  if(!chatId) throw new Error("Telegram chat ID required");
  return deliverReservedTransfer(row,{
    read,publish,
    send:async item=>{
      const receipt=await transport(formatMessage(item));
      return acceptedReceipt(receipt,chatId);
    }
  });
}
