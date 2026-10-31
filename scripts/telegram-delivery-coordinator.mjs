import {readRemoteDeliveryState,publishDeliveryState} from "./telegram-remote-state.mjs";
import {reserveTransfers,transferKey,confirmRemoteReservation,resolveReservation} from "./telegram-delivery-state.mjs";

/**
 * Isolated delivery coordinator. The caller supplies send(row), which MUST
 * be invoked only after the remote reservation commit has been confirmed.
 * Not wired into the scheduled workflow or live notifier.
 */
export async function deliverReservedTransfer(row,{read=readRemoteDeliveryState,publish=publishDeliveryState,send}) {
  if(typeof send!=="function") throw new Error("Explicit send callback required");
  const initial=await read();
  const prepared=reserveTransfers([row],initial.state);
  if(prepared.rows.length===0) return {status:"already-recorded"};
  const committed=await publish(initial,prepared.state);
  confirmRemoteReservation(prepared.state,committed.state,row);
  let outcome;
  try {
    outcome=await send(row);
    if(!outcome || outcome.status!=="accepted" || !outcome.message_id || !outcome.chat_id) {
      outcome={status:"unknown"};
    }
  } catch {
    outcome={status:"unknown"};
  }
  const next=resolveReservation(committed.state,row,outcome);
  try {
    await publish(committed,next);
  } catch {
    // The remote reservation remains authoritative and blocks automatic retry.
    return {status:"reconciliation-required",key:transferKey(row)};
  }
  return {status:outcome.status,key:transferKey(row)};
}
