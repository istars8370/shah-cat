// Offline audit checker: local SHA-256 chain + independently supplied checkpoint.
import {verifyIntegrityRecords} from './integrity-ledger.mjs';
export function verifyAuditBundle(records,checkpoint){
 if(!verifyIntegrityRecords(records))return {ok:false,reason:'broken-chain'};
 if(!checkpoint||!Number.isSafeInteger(checkpoint.count)||typeof checkpoint.headHash!=='string')return {ok:false,reason:'invalid-checkpoint'};
 if(records.length!==checkpoint.count)return {ok:false,reason:'count-mismatch'};
 const head=records.length?records[records.length-1].recordHash:'GENESIS';
 if(head!==checkpoint.headHash)return {ok:false,reason:'head-mismatch'};
 return {ok:true,count:records.length,headHash:head,warning:'checkpoint authenticity must be established independently'};
}
