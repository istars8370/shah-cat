// Research-only off-chain Ed25519 evidence verifier. Not Falcon/FN-DSA or on-chain enforcement.
import {createPublicKey, verify} from 'node:crypto';
import {hashRequest} from './core.mjs';
const PREFIX=Buffer.from('SHAH-4WAY-EVIDENCE-v1\\0','utf8');
export function evidenceMessage(request) {
  const hash=hashRequest(request);
  return Buffer.concat([PREFIX,Buffer.from(hash,'hex')]);
}
export function verifyEvidence(request, entries, policy) {
  if (!Array.isArray(entries) || !Array.isArray(policy.allowedKeys) || !Number.isSafeInteger(policy.threshold) || policy.threshold < 1) return {ok:false,reason:'invalid-policy'};
  const unique=new Set();
  const message=evidenceMessage(request);
  for (const entry of entries) {
    if (!entry || typeof entry.publicKeyDer !== 'string' || typeof entry.signature !== 'string') return {ok:false,reason:'malformed-evidence'};
    if (!policy.allowedKeys.includes(entry.publicKeyDer) || unique.has(entry.publicKeyDer)) return {ok:false,reason:'unauthorized-or-duplicate'};
    try {
      const der=Buffer.from(entry.publicKeyDer,'base64');
      const sig=Buffer.from(entry.signature,'base64');
      if (der.toString('base64')!==entry.publicKeyDer || sig.toString('base64')!==entry.signature || sig.length!==64) return {ok:false,reason:'malformed-encoding'};
      const key=createPublicKey({key:der,format:'der',type:'spki'});
      if (key.asymmetricKeyType!=='ed25519' || !verify(null,message,key,sig)) return {ok:false,reason:'invalid-signature'};
    } catch {return {ok:false,reason:'invalid-key'};}
    unique.add(entry.publicKeyDer);
  }
  return unique.size >= policy.threshold ? {ok:true,verified:unique.size} : {ok:false,reason:'insufficient-signatures'};
}
