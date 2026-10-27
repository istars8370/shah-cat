import test from 'node:test';import assert from 'node:assert/strict';
import {operationsChecklist,productionReady} from './operations-checklist.mjs';
test('operations checklist never claims completed evidence',()=>assert.equal(operationsChecklist().every(x=>x.complete===false),true));
test('production is blocked',()=>assert.equal(productionReady(),false));
