// SHAH CAT Four-Way local research prototype. NOT a Solana program.
// No Falcon verification, on-chain enforcement, funds movement or security guarantee.
import { createHash } from 'node:crypto';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = reason => ({ok:false,reason});
export const hashRequest = request => digest(request);
export function validateRequest(request, context) {
  if (!request || typeof request !== 'object') return fail('invalid-request');
  const fields = ['domain','network','program','account','mint','recipient','amount','nonce','expires','policyVersion'];
  if (fields.some(k => request[k] === undefined || request[k] === null)) return fail('missing-fields');
  if (request.domain !== 'SHAH-4WAY-v0' || request.network !== context.network || request.program !== context.program) return fail('domain-mismatch');
  if (!Number.isSafeInteger(request.amount) || request.amount <= 0 || !Number.isSafeInteger(request.expires)) return fail('invalid-amount-or-expiry');
  if (request.expires <= context.now) return fail('expired');
  if (request.policyVersion !== context.policy.version) return fail('stale-policy');
  if (context.usedNonces.has(request.nonce)) return fail('replay');
  return {ok:true};
}
export function adaptiveDecision(request, context, evidence) {
  const required = request.amount >= context.policy.elevatedAmount ? 2 : 1;
  const unique = new Set(evidence.approvers || []);
  if (unique.size < required) return fail('insufficient-approvals');
  if ([...unique].some(id => !context.policy.allowedApprovers.includes(id))) return fail('unknown-approver');
  // Caller-supplied approver names are NOT cryptographic signatures.
  return {ok:true,required};
}
export function recoveryDecision(state, action, now) {
  if (action.type === 'begin') {
    if (state.pending) return fail('recovery-already-pending');
    if (new Set(action.guardians).size < state.quorum || action.guardians.some(g => !state.guardians.includes(g))) return fail('guardian-quorum');
    return {ok:true,state:{...state,pending:{newOwner:action.newOwner,readyAt:now+state.delay}}};
  }
  if (action.type === 'finalize') {
    if (!state.pending || now < state.pending.readyAt) return fail('timelock');
    return {ok:true,state:{...state,owner:state.pending.newOwner,pending:null,epoch:state.epoch+1}};
  }
  if (action.type === 'cancel') return {ok:true,state:{...state,pending:null}};
  return fail('unknown-recovery-action');
}
export function executeModules(modules, allowlist, input) {
  for (const module of modules) {
    if (!allowlist.includes(module.id)) return fail('unapproved-module');
    if (typeof module.check !== 'function') return fail('invalid-module');
    try { if (module.check(input) !== true) return fail('module-rejected'); }
    catch { return fail('module-error'); }
  }
  return {ok:true};
}
export function integrityRecord(request, decision, previousHash='GENESIS') {
  const record = {requestHash:hashRequest(request),decision,previousHash};
  return {...record,recordHash:digest(record)};
}
export function verifyIntegrityChain(records) {
  let previousHash='GENESIS';
  for (const record of records) {
    const {recordHash,...body}=record;
    if (body.previousHash!==previousHash || digest(body)!==recordHash) return false;
    previousHash=recordHash;
  }
  return true;
}
export function simulateFourWay(request, context, evidence, modules) {
  const validation=validateRequest(request,context);
  if (!validation.ok) return validation;
  const authorization=adaptiveDecision(request,context,evidence);
  if (!authorization.ok) return authorization;
  const modular=executeModules(modules,context.policy.moduleAllowlist,{request,context});
  if (!modular.ok) return modular;
  const record=integrityRecord(request,{status:'simulated-approved',policyVersion:context.policy.version});
  // Deliberately does not mark a nonce used or send transactions: simulation only.
  return {ok:true,record,warning:'simulation-only; no signature verification or on-chain execution'};
}
