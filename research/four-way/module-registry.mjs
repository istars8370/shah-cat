// Research-only deterministic module registry. Not an on-chain authority.
const fail=reason=>({ok:false,reason});
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{1,47}$/.test(id);
export function registerModule(registry,module){
 if(!registry||!Array.isArray(registry.modules)||!module||!validId(module.id)||!Number.isSafeInteger(module.version)||module.version<1)return fail('invalid-module');
 if(!/^[a-f0-9]{64}$/.test(module.codeHash||''))return fail('invalid-code-hash');
 if(registry.modules.some(x=>x.id===module.id))return fail('already-registered');
 return {ok:true,registry:{...registry,modules:[...registry.modules,{id:module.id,version:module.version,codeHash:module.codeHash,enabled:false}]}};
}
export function checkModuleManifest(registry,manifest){
 if(!Array.isArray(manifest)||manifest.length===0)return fail('empty-manifest');
 const seen=new Set();
 for(const entry of manifest){
  if(!entry||!validId(entry.id)||seen.has(entry.id))return fail('duplicate-or-invalid-id');
  seen.add(entry.id);
  const found=registry.modules.find(x=>x.id===entry.id);
  if(!found||!found.enabled||found.version!==entry.version||found.codeHash!==entry.codeHash)return fail('module-not-approved');
 }
 return {ok:true};
}
