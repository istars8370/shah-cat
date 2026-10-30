import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { airdropPublicAPI } from './airdrop-public-api.mjs';

function fakeStore(){
  return {
    snapshot(){return {version:'0.1',startsAt:'2026-10-28T00:00:00.000Z',total:7,counts:{PASS:3,REVIEW:2,REJECT:2},limits:{maxApplications:2000},applications:[{wallet:'secret'}]};},
    async submit(){return {id:'app-1',status:'PASS',reason:'자동 기본검증 통과',score:6,wallet:'hidden'};}
  };
}
async function serve(fn){
  const server=http.createServer((req,res)=>fn(req,res,async()=>fakeStore()).catch(error=>{
    res.writeHead(error.status||500,{'content-type':'application/json'});
    res.end(JSON.stringify({error:error.message}));
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  return {base:'http://127.0.0.1:'+port,close:()=>new Promise(resolve=>server.close(resolve))};
}
test('public status exposes aggregate data only',async()=>{
  const prior=process.env.AIRDROP_PUBLIC_ORIGIN;
  process.env.AIRDROP_PUBLIC_ORIGIN='https://airdrop.example.com';
  const s=await serve(airdropPublicAPI);
  try{
    const r=await fetch(s.base+'/api/airdrop/public/status',{headers:{origin:'https://airdrop.example.com'}});
    assert.equal(r.status,200);
    const d=await r.json();
    assert.equal(d.total,7);
    assert.equal(d.automaticExecution,false);
    assert.equal('applications' in d,false);
  }finally{await s.close();if(prior===undefined)delete process.env.AIRDROP_PUBLIC_ORIGIN;else process.env.AIRDROP_PUBLIC_ORIGIN=prior;}
});

test('public API rejects an unapproved origin',async()=>{
  const prior=process.env.AIRDROP_PUBLIC_ORIGIN;
  process.env.AIRDROP_PUBLIC_ORIGIN='https://airdrop.example.com';
  const s=await serve(airdropPublicAPI);
  try{
    const r=await fetch(s.base+'/api/airdrop/public/status',{headers:{origin:'https://evil.example'}});
    assert.equal(r.status,403);
  }finally{await s.close();if(prior===undefined)delete process.env.AIRDROP_PUBLIC_ORIGIN;else process.env.AIRDROP_PUBLIC_ORIGIN=prior;}
});

test('public submit returns minimal result and never admin fields',async()=>{
  const prior=process.env.AIRDROP_PUBLIC_ORIGIN;
  process.env.AIRDROP_PUBLIC_ORIGIN='https://airdrop.example.com';
  const s=await serve(airdropPublicAPI);
  try{
    const r=await fetch(s.base+'/api/airdrop/public/applications',{
      method:'POST',
      headers:{origin:'https://airdrop.example.com','content-type':'application/json'},
      body:JSON.stringify({communityId:'x'})
    });
    assert.equal(r.status,201);
    const d=await r.json();
    assert.deepEqual(Object.keys(d).sort(),['id','reason','score','status']);
  }finally{await s.close();if(prior===undefined)delete process.env.AIRDROP_PUBLIC_ORIGIN;else process.env.AIRDROP_PUBLIC_ORIGIN=prior;}
});


test('public health exposes readiness boolean only',async()=>{
  const priorOrigin=process.env.AIRDROP_PUBLIC_ORIGIN;
  const priorStart=process.env.AIRDROP_STARTS_AT;
  const priorToken=process.env.AIRDROP_ADMIN_TOKEN;
  process.env.AIRDROP_PUBLIC_ORIGIN='https://airdrop.example.com';
  process.env.AIRDROP_STARTS_AT='2026-11-01T00:00:00.000Z';
  process.env.AIRDROP_ADMIN_TOKEN='abcdefghijklmnopqrstuvwxyz123456';
  const s=await serve(airdropPublicAPI);
  try{
    const r=await fetch(s.base+'/api/airdrop/public/health',{headers:{origin:'https://airdrop.example.com'}});
    assert.equal(r.status,200);
    const d=await r.json();
    assert.deepEqual(Object.keys(d).sort(),['ready','version']);
    assert.equal(d.ready,true);
  }finally{
    await s.close();
    if(priorOrigin===undefined) delete process.env.AIRDROP_PUBLIC_ORIGIN; else process.env.AIRDROP_PUBLIC_ORIGIN=priorOrigin;
    if(priorStart===undefined) delete process.env.AIRDROP_STARTS_AT; else process.env.AIRDROP_STARTS_AT=priorStart;
    if(priorToken===undefined) delete process.env.AIRDROP_ADMIN_TOKEN; else process.env.AIRDROP_ADMIN_TOKEN=priorToken;
  }
});
