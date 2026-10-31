import {reserveTransfers,confirmRemoteReservation,assertRemoteStateUnchanged,resolveReservation,transferKey} from "./telegram-delivery-state.mjs";

/**
 * Offline stateful simulation of the remote data branch.
 * No Telegram calls, no GitHub writes, no credentials.
 */
export class MockDeliveryBranch {
  constructor(state={}) { this.state=structuredClone(state); this.version=0; }
  read() { return {state:structuredClone(this.state),version:this.version}; }
  compareAndSwap(version,next) {
    if(version!==this.version) throw new Error("Remote branch conflict");
    this.state=structuredClone(next);
    this.version++;
    return this.read();
  }
}

export function reserveAndConfirm(branch,rows) {
  const snapshot=branch.read();
  const prepared=reserveTransfers(rows,snapshot.state);
  if(!prepared.rows.length) return {rows:[],snapshot};
  const committed=branch.compareAndSwap(snapshot.version,prepared.state);
  assertRemoteStateUnchanged(prepared.state,committed.state);
  for(const row of prepared.rows) confirmRemoteReservation(prepared.state,committed.state,row);
  return {rows:prepared.rows,snapshot:committed};
}

export function acknowledge(branch,snapshot,row,outcome) {
  const latest=branch.read();
  if(latest.version!==snapshot.version) throw new Error("Remote branch conflict");
  const next=resolveReservation(latest.state,row,outcome);
  return branch.compareAndSwap(latest.version,next);
}

export function recoveryCandidates(branch) {
  return Object.entries(branch.read().state)
    .filter(([,entry])=>["reserved","unknown"].includes(entry.status))
    .map(([key,entry])=>({key,status:entry.status}));
}
