// Research-only immutable recovery state machine; guardian IDs are not signed proofs.
const fail=reason=>({ok:false,reason});
export function initiateRecovery(state,{newOwner,guardians,nonce},now){
 if(!state||state.pending)return fail('already-pending');
 if(typeof newOwner!=='string'||!newOwner||newOwner===state.owner)return fail('invalid-new-owner');
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(state.delay)||state.delay<1)return fail('invalid-timelock');
 if(typeof nonce!=='string'||!nonce||state.usedNonces.includes(nonce))return fail('replay');
 if(!Array.isArray(guardians)||new Set(guardians).size!==guardians.length||guardians.length<state.quorum||guardians.some(g=>!state.guardians.includes(g)))return fail('invalid-guardians');
 return {ok:true,state:{...state,pending:{newOwner,readyAt:now+state.delay,nonce,epoch:state.epoch},usedNonces:[...state.usedNonces,nonce]}};
}
export function finalizeRecovery(state,now){
 if(!state.pending)return fail('no-pending');
 if(state.pending.epoch!==state.epoch)return fail('stale-epoch');
 if(now<state.pending.readyAt)return fail('timelock');
 return {ok:true,state:{...state,owner:state.pending.newOwner,pending:null,epoch:state.epoch+1}};
}
export function cancelRecovery(state){return state.pending?{ok:true,state:{...state,pending:null}}:fail('no-pending');}
