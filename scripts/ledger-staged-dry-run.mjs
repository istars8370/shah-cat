import { deliverReservedTransfer } from "./telegram-delivery-coordinator.mjs";
import { transferKey } from "./telegram-delivery-state.mjs";

/**
 * Offline-only staged runner. All remote writes are in memory; send is a
 * deterministic mock. Never imports Telegram API or GitHub remote transport.
 */
export async function simulateDeliveryBatch(rows,{failAt=null}={}) {
  let state={},version=0,sends=0;
  const trace=[];
  const read=async()=>({commit:String(version),state:structuredClone(state)});
  const publish=async(snapshot,next)=>{
    if(snapshot.commit!==String(version)) throw new Error("Simulated branch conflict");
    const stage=Object.keys(next).some(key=>next[key]?.status==="reserved" && !Object.hasOwn(state,key))
      ?"reserve":"acknowledge";
    if(failAt===stage) throw new Error("Simulated "+stage+" failure");
    state=structuredClone(next);
    version++;
    trace.push(stage);
    return read();
  };
  const send=async row=>{
    sends++;
    trace.push("send");
    if(failAt==="send") throw new Error("Simulated Telegram timeout");
    return {status:"accepted",message_id:sends,chat_id:"offline-mock"};
  };
  const results=[];
  for(const row of rows) {
    const key=transferKey(row);
    try {
      results.push({key,...await deliverReservedTransfer(row,{read,publish,send})});
    } catch(error) {
      results.push({key,status:"blocked",reason:error.message});
      break;
    }
  }
  return {state,results,sends,trace};
}
