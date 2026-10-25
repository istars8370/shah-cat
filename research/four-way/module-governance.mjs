// Research-only state transitions. Approval evidence MUST be authenticated upstream.
const fail=reason=>({ok:false,reason});
export function proposeUpgrade(registry,proposal,now){
 if(!registry||!Array.isArray(registry.modules)||!Number.isSafeInteger(registry.delay)||registry.delay<1||!Number.isSafeInteger(now))return fail('invalid-registry');
 const current=registry.modules.find(x=>x.id===proposal?.id);
 if(!current||!Number.isSafeInteger(proposal.version)||proposal.version<=current.version||!/^[a-f0-9]{64}$/.test(proposal.codeHash||''))return fail('invalid-upgrade');
 if(registry.pending?.some(x=>x.id===proposal.id))return fail('upgrade-already-pending');
 return {ok:true,registry:{...registry,pending:[...(registry.pending||[]),{...proposal,readyAt:now+registry.delay}]}};
}
export function activateUpgrade(registry,id,now,authenticatedApproval){
 if(authenticatedApproval!==true)return fail('approval-required');
 const pending=registry.pending?.find(x=>x.id===id);
 if(!pending)return fail('not-pending');
 if(now<pending.readyAt)return fail('timelock');
 return {ok:true,registry:{...registry,modules:registry.modules.map(x=>x.id===id?{id,version:pending.version,codeHash:pending.codeHash,enabled:true}:x),pending:registry.pending.filter(x=>x.id!==id)}};
}
export function disableModule(registry,id,authenticatedApproval){
 if(authenticatedApproval!==true)return fail('approval-required');
 if(!registry.modules.some(x=>x.id===id))return fail('unknown-module');
 return {ok:true,registry:{...registry,modules:registry.modules.map(x=>x.id===id?{...x,enabled:false}:x)}};
}
