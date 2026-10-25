// Research-only compatibility gate. Does NOT perform Falcon verification.
// Reject unreviewed algorithms and ambiguous Tidecoin legacy vs standard FN-DSA profiles.
export const PROFILES=Object.freeze({
  'tidecoin-legacy-falcon512':Object.freeze({kind:'legacy',status:'experimental',verified:false}),
  'fn-dsa-512':Object.freeze({kind:'standard-candidate',status:'unverified',verified:false})
});
export function validateFalconDescriptor(d) {
  if (!d || typeof d !== 'object') return {ok:false,reason:'missing-descriptor'};
  if (!Object.hasOwn(PROFILES,d.profile)) return {ok:false,reason:'unknown-profile'};
  if (!/^[a-f0-9]{40}$/.test(d.upstreamCommit||'')) return {ok:false,reason:'unpinned-source'};
  if (!/^[a-f0-9]{64}$/.test(d.messageSha256||'')) return {ok:false,reason:'invalid-message-digest'};
  if (!Number.isSafeInteger(d.keyVersion)||d.keyVersion<1) return {ok:false,reason:'invalid-key-version'};
  if (d.profile==='fn-dsa-512' && d.legacyWireFormat===true) return {ok:false,reason:'cross-profile-wire-format'};
  return {ok:true,profile:PROFILES[d.profile],authorizationAllowed:false};
}
export function canAuthorizeFalconTransfer() {
  // Explicit fail-closed until independently verified on-chain verifier and custody program.
  return {ok:false,reason:'falcon-onchain-enforcement-not-validated'};
}
