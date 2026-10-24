import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import http from 'node:http';
import { sign } from 'node:crypto';
import { createRequestHandler } from './server.mjs';
import { fixture, content } from './treasury-test-fixtures.mjs';
const scripts=['project-config.js','shared.js','treasury-ui.js'].map(x=>readFileSync(new URL(x,import.meta.url),'utf8')).join('\n');
async function ui(t,configured=true) {
 const f=await fixture(t),app=http.createServer(createRequestHandler(()=>{throw Error('No RPC');},fetch,async()=>configured?f.store:null));
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{app.closeAllConnections();app.close(resolve);}));
 const origin='http://127.0.0.1:'+app.address().port,elements=new Map(),requests=[],calls={connect:0,sign:0},events=new Map(),downloads=[];
 const node=()=>({value:'',checked:false,disabled:false,textContent:'',children:[],handlers:{},append(child){this.children.push(child);},replaceChildren(){this.children=[];},addEventListener(type,fn){this.handlers[type]=fn;},async fire(type='click'){if(this.disabled)return;return this.handlers[type]?.({preventDefault(){}});},click(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
 el('treasuryKind').value='budget';el('treasuryDecision').value='approve';el('treasuryFee').value='0.001';
 let signer='seongjae',signHook=null,fetchHook=null;
 const publicKey=()=>({toBase58:()=>f.config.signers[signer]});
 const provider={isPhantom:true,get publicKey(){return publicKey();},connect:async()=>{calls.connect++;return{publicKey:publicKey()};},on:(name,fn)=>events.set(name,fn),removeListener:name=>events.delete(name),signMessage:async bytes=>{calls.sign++;if(signHook)return signHook(bytes);return{signature:new Uint8Array(sign(null,Buffer.from(bytes),f.pairs[signer].privateKey)),publicKey:publicKey()};}};
 vm.runInNewContext(scripts,{document:{getElementById:el,createElement:node},window:{phantom:{solana:provider}},Uint8Array,TextEncoder,URLSearchParams,Blob,Date,btoa,setTimeout,
 URL:{createObjectURL(blob){downloads.push(blob);return'blob:ledger';},revokeObjectURL(){}},
 fetch:async(path,opts={})=>{requests.push({path,opts});if(fetchHook){const result=await fetchHook(path,opts);if(result)return result;}return fetch(origin+path,{...opts,headers:{origin,...opts.headers}});}});
 for(let i=0;i<30&&el('treasuryMessage').textContent==='';i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.ok(el('treasuryMessage').textContent);
 const create=async()=>{el('treasuryAmount').value='1000';el('treasuryPurpose').value='테스트 인프라';el('treasuryEvidence').value='견적서';el('treasuryStart').value='2026-10-01';el('treasuryEnd').value='2026-11-01';await el('treasuryForm').fire('submit');};
 const choose=()=>el('treasuryRequests').children[0].children[3].children[0].fire();
 return {...f,el,calls,requests,downloads,create,choose,provider,setSigner:id=>{signer=id;events.get('accountChanged')?.(publicKey());},setSignHook:fn=>{signHook=fn;},setFetchHook:fn=>{fetchHook=fn;}};
}
test('Treasury UI starts without wallet permissions and disables writes before config',async t=>{
 const w=await ui(t,false);assert.equal(w.calls.connect,0);assert.equal(w.calls.sign,0);assert.equal(w.el('treasurySave').disabled,true);assert.equal(w.el('treasurySign').disabled,true);assert.match(w.el('treasuryMessage').textContent,/설정/);
});
test('UI creates a request, displays exact message and records three independent wallet signatures',async t=>{
 const w=await ui(t);await w.create();assert.equal(w.store.snapshot().requests.length,1);await w.choose();
 await w.el('treasuryConnect').fire();assert.match(w.el('treasuryWallet').textContent,/성재/);
 for(const id of ['seongjae','dongwon','parkwon']){
  w.setSigner(id);assert.equal(w.el('treasurySign').disabled,true);await w.el('treasuryPrepare').fire();assert.match(w.el('treasurySigningText').textContent,/NOT A TRANSACTION/);assert.equal(w.el('treasurySign').disabled,false);await w.el('treasurySign').fire();
 }
 assert.equal(w.calls.sign,3);assert.equal(w.store.snapshot().requests[0].status,'policy_approved');assert.equal(w.el('treasuryPrepare').disabled,true);
 w.el('treasuryExport').handlers.click();const exported=JSON.parse(await w.downloads[0].text());assert.equal(exported.executionEnabled,false);assert.equal(exported.requests[0].approvals.length,3);
});
test('UI editing creates a new version and removes former approvals',async t=>{
 const w=await ui(t);await w.create();await w.choose();await w.el('treasuryConnect').fire();await w.el('treasuryPrepare').fire();await w.el('treasurySign').fire();
 await w.el('treasuryEdit').fire();w.el('treasuryPurpose').value='수정 견적';await w.el('treasuryForm').fire('submit');
 const p=w.store.snapshot().requests[0];assert.equal(p.revision,2);assert.equal(p.approvals.length,0);assert.equal(p.content.purpose,'수정 견적');
});
test('account switch during wallet prompt discards the signature before posting',async t=>{
 const w=await ui(t);await w.create();await w.choose();await w.el('treasuryConnect').fire();await w.el('treasuryPrepare').fire();
 w.setSignHook(async bytes=>{const signature=new Uint8Array(sign(null,Buffer.from(bytes),w.pairs.seongjae.privateKey));w.setSigner('dongwon');return{signature,publicKey:{toBase58:()=>w.config.signers.seongjae}};});
 await w.el('treasurySign').fire();assert.equal(w.store.snapshot().requests[0].approvals.length,0);assert.equal(w.requests.filter(x=>x.path==='/api/treasury/decisions').length,0);assert.match(w.el('treasuryMessage').textContent,/변경/);
});
test('decision switch invalidates prepared approval and tampered challenge is rejected',async t=>{
 const w=await ui(t);await w.create();await w.choose();await w.el('treasuryConnect').fire();await w.el('treasuryPrepare').fire();
 w.el('treasuryDecision').value='reject';await w.el('treasuryDecision').fire('change');assert.equal(w.el('treasurySign').disabled,true);
 w.setFetchHook(async path=>{if(path.startsWith('/api/treasury/message'))return{ok:true,json:async()=>({message:'forged',address:w.config.signers.seongjae})};});
 await w.el('treasuryPrepare').fire();assert.equal(w.el('treasurySign').disabled,true);assert.equal(w.calls.sign,0);assert.match(w.el('treasuryMessage').textContent,/불일치/);
});
test('wallet rejection leaves request pending and cannot reuse a prepared message',async t=>{
 const w=await ui(t);await w.create();await w.choose();await w.el('treasuryConnect').fire();await w.el('treasuryPrepare').fire();
 w.setSignHook(async()=>{throw Error('사용자가 서명을 거절했습니다.');});await w.el('treasurySign').fire();
 assert.equal(w.store.snapshot().requests[0].approvals.length,0);assert.equal(w.el('treasurySign').disabled,true);assert.match(w.el('treasuryMessage').textContent,/거절/);
});
