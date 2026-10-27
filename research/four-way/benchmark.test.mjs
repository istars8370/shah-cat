import test from 'node:test';import assert from 'node:assert/strict';import {benchmarkFourWay} from './benchmark.mjs';
test('benchmark reports off-chain metrics only',()=>{const x=benchmarkFourWay(2);assert.equal(x.iterations,2);assert.equal(x.solanaComputeUnits,null);assert.equal(x.solanaFeeLamports,null);assert.ok(x.averageMs>=0);});
test('rejects invalid iteration count',()=>assert.throws(()=>benchmarkFourWay(0),/invalid-iterations/));
