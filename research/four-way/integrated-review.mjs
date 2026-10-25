// Read-only integration review: no state changes, signing, or token transfers.
import {evaluateAdaptivePolicy} from './adaptive-policy.mjs';
import {checkModuleManifest} from './module-registry.mjs';
import {verifyIntegrityRecords} from './integrity-ledger.mjs';
export function reviewFourWay({request,context,evidence,registry,manifest,recoveryState,records}){
 const a=evaluateAdaptivePolicy(request,context,evidence);
 if(!a.ok)return {ok:false,stage:'adaptive',reason:a.reason};
 if(recoveryState?.frozen||recoveryState?.pending)return {ok:false,stage:'recovery',reason:'recovery-lock'};
 const c=checkModuleManifest(registry,manifest);
 if(!c.ok)return {ok:false,stage:'modules',reason:c.reason};
 if(!verifyIntegrityRecords(records))return {ok:false,stage:'integrity',reason:'invalid-history'};
 return {ok:true,stages:['adaptive','recovery','modules','integrity'],canTransfer:false,warning:'read-only off-chain simulation'};
}
