import test from 'node:test';import assert from 'node:assert/strict';
import {freeze,unfreeze,finalizeWithControls,rotateGuardians} from './recovery-controls.mjs';
import {initiateRecovery} from './guardian-recovery.mjs';
const s={owner:'alice',guardians:['g1','g2'],quorum:2,delay:10,epoch:0,pending:null,usedNonces:[],frozen:false};
test('freeze blocks recovery finalization',()=>{const p=initiateRecovery(s,{newOwner:'bob',guardians:['g1','g2'],nonce:'n'},1).state;assert.equal(finalizeWithControls(freeze(p,'incident').state,100).reason,'frozen');});
test('unfreeze needs approval flag',()=>assert.equal(unfreeze({...s,frozen:true},false).reason,'approval-required'));
test('rotate guardians bumps epoch',()=>assert.equal(rotateGuardians(s,['x','y','z'],2).state.epoch,1));
test('cannot rotate during pending recovery',()=>{const p=initiateRecovery(s,{newOwner:'bob',guardians:['g1','g2'],nonce:'n'},1).state;assert.equal(rotateGuardians(p,['x','y'],2).reason,'pending-recovery');});
test('reject duplicate guardians',()=>assert.equal(rotateGuardians(s,['x','x'],2).reason,'invalid-guardian-set'));
