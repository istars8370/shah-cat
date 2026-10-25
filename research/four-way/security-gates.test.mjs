import test from 'node:test';import assert from 'node:assert/strict';
import {BLOCKERS,assessReadiness} from './security-gates.mjs';
test('empty evidence blocks release',()=>{const r=assessReadiness();assert.equal(r.releaseReady,false);assert.equal(r.missing.length,BLOCKERS.length);});
test('partial evidence remains blocked',()=>assert.equal(assessReadiness({'falcon-vectors-unverified':true}).releaseReady,false));
test('checklist never automatically authorizes deployment',()=>assert.equal(assessReadiness(Object.fromEntries(BLOCKERS.map(k=>[k,true]))).productionDeploymentAllowed,false));
