// Research-only deterministic encoding for a fixed allowlist of fields.
// Does not retrofit prior JSON.stringify-based signatures or chain records.
import {createHash} from 'node:crypto';
const KEYS=['domain','network','program','account','mint','recipient','amount','nonce','expires','policyVersion'];
export function canonicalEnvelope(request){
 if(!request||typeof request!=='object'||Object.keys(request).length!==KEYS.length||KEYS.some(k=>!Object.hasOwn(request,k)))throw Error('unexpected-fields');
 const ordered={};
 for(const key of KEYS){
  const value=request[key];
  if(key==='amount'||key==='expires'||key==='policyVersion'){
   if(!Number.isSafeInteger(value)||value<0)throw Error('invalid-integer');
  }else if(typeof value!=='string'||value.length===0||value.length>256)throw Error('invalid-string');
  ordered[key]=value;
 }
 return Buffer.from(JSON.stringify(ordered),'utf8');
}
export function canonicalEnvelopeHash(request){
 return createHash('sha256').update(Buffer.from('SHAH-4WAY-CANONICAL-v1\\0')).update(canonicalEnvelope(request)).digest('hex');
}
