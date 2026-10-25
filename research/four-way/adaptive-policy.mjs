// Off-chain research policy engine only. No Solana custody or transfer authorization.
import {validateRequest} from './core.mjs';
import {verifyEvidence} from './ed25519-evidence.mjs';
const reject=reason=>({ok:false,reason});
export function assessTier(request,policy) {
  if (!Number.isSafeInteger(policy.elevatedAmount)||policy.elevatedAmount<=0) return reject('invalid-threshold');
  if (!Number.isSafeInteger(policy.emergencyAmount)||policy.emergencyAmount<=policy.elevatedAmount) return reject('invalid-emergency-threshold');
  const tier=request.amount>=policy.emergencyAmount?'emergency':request.amount>=policy.elevatedAmount?'elevated':'ordinary';
  return {ok:true,tier};
}
export function evaluateAdaptivePolicy(request,context,entries) {
  const basic=validateRequest(request,context);
  if (!basic.ok) return basic;
  const policy=context.policy;
  if (!policy||typeof policy!=='object'||!policy.thresholds) return reject('missing-policy');
  const tier=assessTier(request,policy);
  if (!tier.ok) return tier;
  if (tier.tier==='emergency' && policy.emergencyLock!==false) return reject('emergency-locked');
  const required=policy.thresholds[tier.tier];
  if (!Number.isSafeInteger(required)||required<1) return reject('invalid-approval-threshold');
  const verified=verifyEvidence(request,entries,{allowedKeys:policy.allowedKeys,threshold:required});
  if (!verified.ok) return verified;
  return {ok:true,tier:tier.tier,verified:verified.verified,authorization:'offchain-evidence-only',canExecuteOnchain:false};
}
