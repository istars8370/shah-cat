import test from 'node:test';import assert from 'node:assert/strict';import {releaseManifest} from './release-manifest.mjs';
test('research release manifest remains no-go',()=>{const x=releaseManifest();assert.equal(x.deploymentEnabled,false);assert.equal(x.readiness.releaseReady,false);assert.equal(x.tracks.length,4);});
