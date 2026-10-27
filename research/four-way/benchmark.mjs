// Research-only microbenchmark. NOT Solana compute units, fees or on-chain security.
import {performance} from 'node:perf_hooks';
import {generateKeyPairSync,sign} from 'node:crypto';
import {evidenceMessage,verifyEvidence} from './ed25519-evidence.mjs';
import {evaluateAdaptivePolicy} from './adaptive-policy.mjs';
export function benchmarkFourWay(iterations=1000){
 if(!Number.isSafeInteger(iterations)||iterations<1||iterations>100000)throw Error('invalid-iterations');
 const key=generateKeyPairSync('ed25519');
 const publicKeyDer=key.publicKey.export({format:'der',type:'spki'}).toString('base64');
 const request={domain:'SHAH-4WAY-v0',network:'devnet',program:'test',account:'vault',mint:'SHAH',recipient:'receiver',amount:1,nonce:'benchmark',expires:999999,policyVersion:1};
 const evidence=[{publicKeyDer,signature:sign(null,evidenceMessage(request),key.privateKey).toString('base64')}];
 const context={network:'devnet',program:'test',now:1,usedNonces:new Set(),policy:{version:1,elevatedAmount:10,emergencyAmount:100,thresholds:{ordinary:1,elevated:2,emergency:2},allowedKeys:[publicKeyDer]}};
 const start=performance.now();
 for(let i=0;i<iterations;i++){
  if(!verifyEvidence(request,evidence,{allowedKeys:[publicKeyDer],threshold:1}).ok)throw Error('verify-failed');
  if(!evaluateAdaptivePolicy(request,context,evidence).ok)throw Error('policy-failed');
 }
 const elapsedMs=performance.now()-start;
 return {iterations,elapsedMs,averageMs:elapsedMs/iterations,environment:'local-node-offchain',solanaComputeUnits:null,solanaFeeLamports:null};
}
