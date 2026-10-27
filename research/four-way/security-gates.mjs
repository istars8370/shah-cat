// Conservative static readiness gates. This is NOT an independent security audit.
export const BLOCKERS=Object.freeze([
 'falcon-vectors-unverified','guardian-authentication-missing',
 'nonce-not-onchain','governance-authentication-missing',
 'trusted-clock-missing','audit-checkpoint-unanchored',
 'custody-program-not-audited','devnet-transfer-not-tested'
]);
export function assessReadiness(evidence={}){
 const missing=BLOCKERS.filter(key=>evidence[key]!==true);
 return {releaseReady:missing.length===0,missing,productionDeploymentAllowed:false,
  note:'Even a green checklist cannot authorize production deployment without independent audit and governance'};
}
