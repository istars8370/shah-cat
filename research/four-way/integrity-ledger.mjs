// Research-only append-only hash chain. In-memory; no external anchoring or persistence.
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function appendIntegrityRecord(records,entry){
 if(!Array.isArray(records)||!entry||typeof entry!=='object'||typeof entry.requestHash!=='string'||!/^[a-f0-9]{64}$/.test(entry.requestHash))return {ok:false,reason:'invalid-entry'};
 if(!verifyIntegrityRecords(records))return {ok:false,reason:'broken-history'};
 const sequence=records.length;
 const previousHash=sequence?records[sequence-1].recordHash:'GENESIS';
 const body={sequence,previousHash,requestHash:entry.requestHash,decision:entry.decision,policyVersion:entry.policyVersion,algorithm:entry.algorithm};
 return {ok:true,records:[...records,{...body,recordHash:hash(body)}]};
}
export function verifyIntegrityRecords(records){
 if(!Array.isArray(records))return false;
 let previousHash='GENESIS';
 for(let i=0;i<records.length;i++){
  const r=records[i];if(!r||r.sequence!==i||r.previousHash!==previousHash)return false;
  const {recordHash,...body}=r;if(hash(body)!==recordHash)return false;
  previousHash=recordHash;
 }
 return true;
}
