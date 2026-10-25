// Simulation only. Administrative identity/authentication must be enforced elsewhere.
import {finalizeRecovery} from './guardian-recovery.mjs';
const fail=reason=>({ok:false,reason});
export function freeze(state,reason){if(typeof reason!=='string'||!reason.trim())return fail('reason-required');return {ok:true,state:{...state,frozen:true,freezeReason:reason}};}
export function unfreeze(state,approved){if(approved!==true)return fail('approval-required');return {ok:true,state:{...state,frozen:false,freezeReason:null}};}
export function finalizeWithControls(state,now){
 if(state.frozen)return fail('frozen');
 return finalizeRecovery(state,now);
}
export function rotateGuardians(state,next,quorum){
 if(state.pending)return fail('pending-recovery');
 if(!Array.isArray(next)||!Number.isSafeInteger(quorum)||quorum<2||quorum>next.length||new Set(next).size!==next.length||next.some(g=>typeof g!=='string'||!g))return fail('invalid-guardian-set');
 return {ok:true,state:{...state,guardians:[...next],quorum,epoch:state.epoch+1}};
}
