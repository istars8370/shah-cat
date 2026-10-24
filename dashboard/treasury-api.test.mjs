import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequestHandler } from './server.mjs';
import { fixture, content } from './treasury-test-fixtures.mjs';
import { sign } from 'node:crypto';
async function server(t, store=null) {
 const app=http.createServer(createRequestHandler(()=>{throw Error('RPC must not be called');},fetch,async()=>store));
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>{app.closeAllConnections();app.close(resolve);}));
 const origin='http://127.0.0.1:'+app.address().port;
 const post=(path,body,headers={})=>fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 return {origin,post};
}
test('unconfigured API is read-only and disabled without RPC or files',async t=>{
 const w=await server(t); const response=await fetch(w.origin+'/api/treasury');assert.equal(response.status,200);const data=await response.json();assert.equal(data.enabled,false);assert.equal(data.executionEnabled,false);assert.deepEqual(data.events,[]);
 assert.equal((await w.post('/api/treasury/requests',content())).status,409);
 for(const path of ['/treasury.html','/treasury-ui.js'])assert.equal((await fetch(w.origin+path)).status,200);
 assert.match(await (await fetch(w.origin)).text(),/href="\/treasury.html"/);
});
test('Treasury writes reject cross-origin, wrong Host, non-JSON, malformed and oversized bodies',async t=>{
 const f=await fixture(t),w=await server(t,f.store);
 for(const headers of [{origin:'https://evil.example'},{origin:''},{'content-type':'text/plain'}])assert.equal((await w.post('/api/treasury/requests',content(),headers)).status,403);
 const wrongHost=await new Promise(resolve=>{ const r=http.get(w.origin+'/api/treasury',{headers:{host:'evil.example:4173'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',e=>{throw e;}); });assert.equal(wrongHost,403);
 assert.equal((await w.post('/api/treasury/requests','{')).status,400);
 assert.equal((await fetch(w.origin+'/api/treasury',{method:'DELETE'})).status,405);
 assert.equal((await w.post('/api/treasury/requests',{...content(),secret:'no'})).status,400);
 const large=await w.post('/api/treasury/requests',{...content(),evidence:'x'.repeat(17000)});assert.equal(large.status,413);
 assert.equal(f.store.snapshot().requests.length,0);
});
test('HTTP request, exact signing payload and independent approvals persist without any transaction endpoint',async t=>{
 const f=await fixture(t),w=await server(t,f.store);
 const created=await w.post('/api/treasury/requests',content());assert.equal(created.status,201);const p=await created.json();
 for(const signer of ['seongjae','dongwon','parkwon']){
  const query=new URLSearchParams({id:p.id,revision:'1',signer,decision:'approve'});
  const challenge=await (await fetch(w.origin+'/api/treasury/message?'+query)).json();
  const signature=sign(null,Buffer.from(challenge.message),f.pairs[signer].privateKey).toString('base64');
  const response=await w.post('/api/treasury/decisions',{id:p.id,revision:1,signer,decision:'approve',signature});assert.equal(response.status,200);
 }
 const result=await (await fetch(w.origin+'/api/treasury')).json();assert.equal(result.requests[0].status,'policy_approved');assert.equal(result.events.length,5);assert.equal(result.executionEnabled,false);
 assert.equal((await w.post('/api/treasury/execute',{id:p.id})).status,404);
 assert.equal((await w.post('/api/treasury/revise',{id:p.id,revision:1,content:content()})).status,409);
 const duplicate=new URLSearchParams({id:p.id,revision:'1',signer:'seongjae',decision:'approve'});duplicate.append('id',p.id);
 assert.equal((await fetch(w.origin+'/api/treasury/message?'+duplicate)).status,400);
});
