import test from 'node:test';import assert from 'node:assert/strict';
import {registerModule,checkModuleManifest} from './module-registry.mjs';
const module={id:'policy-guard',version:1,codeHash:'a'.repeat(64)};
test('registers disabled module',()=>{const r=registerModule({modules:[]},module);assert.equal(r.ok,true);assert.equal(r.registry.modules[0].enabled,false);});
test('rejects duplicate module',()=>{const r=registerModule({modules:[]},module);assert.equal(registerModule(r.registry,module).reason,'already-registered');});
test('rejects unapproved module',()=>assert.equal(checkModuleManifest({modules:[{...module,enabled:false}]},[module]).reason,'module-not-approved'));
test('rejects code hash mismatch',()=>assert.equal(checkModuleManifest({modules:[{...module,enabled:true}]},[{...module,codeHash:'b'.repeat(64)}]).reason,'module-not-approved'));
test('accepts approved exact manifest',()=>assert.equal(checkModuleManifest({modules:[{...module,enabled:true}]},[module]).ok,true));
