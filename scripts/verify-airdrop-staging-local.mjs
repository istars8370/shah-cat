// Isolated real HTTP/TLS integration; never contacts a remote host or chain.
import assert from 'node:assert/strict';
import { fork, spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import { request } from 'node:https';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { renderNginx } from './render-airdrop-nginx.mjs';

const root=resolve('.');
const nginx=process.env.NGINX_BIN||'nginx',openssl=process.env.OPENSSL_BIN||'openssl';
const dir=await mkdtemp(join(process.env.STAGING_TMP_DIR||tmpdir(),'shah-staging-'));
const cert=join(dir,'cert.pem'),key=join(dir,'key.pem'),config=join(dir,'nginx.conf').replaceAll('\\','/');
const ledger=join(dir,'private','events.jsonl'),backups=join(dir,'backups');
const origin='https://127.0.0.1:18443';
const env={...process.env,PORT:'4173',AIRDROP_STARTS_AT:new Date(Date.now()-60000).toISOString(),
  AIRDROP_PUBLIC_ORIGIN:origin,AIRDROP_ADMIN_TOKEN:'isolated-test-only-token-not-for-deployment',AIRDROP_LEDGER_PATH:ledger};
const checks=[];
function run(exe,args,extra={}){
  const r=spawnSync(exe,args,{cwd:root,encoding:'utf8',windowsHide:true,...extra});
  assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout||r.stderr;
}
async function free(port){
  const s=net.createServer();await new Promise((ok,no)=>s.once('error',no).listen(port,'127.0.0.1',ok));
  await new Promise(ok=>s.close(ok));
}
await free(4173);await free(18443);
await mkdir(join(dir,'logs'));
await mkdir(join(dir,'temp'));
run(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1',
  '-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1']);
await writeFile(config,await renderNginx({origin,cert,key,listen:'127.0.0.1:18443'}));
const ca=await readFile(cert);
function get(path,{method='GET',headers={},body}={}){
  return new Promise((ok,no)=>{
    const q=request(origin,{path,method,headers,ca,rejectUnauthorized:true,timeout:10000},r=>{
      const data=[];r.on('data',b=>data.push(b));r.on('end',()=>ok({status:r.statusCode,
        data:Buffer.concat(data).toString(),tls:q.socket.getProtocol()}));
    });q.on('error',no);q.on('timeout',()=>q.destroy(Error('timeout')));q.end(body);
  });
}
let app,edge;
async function start(){
  app=fork(join(root,'dashboard/server.mjs'),[],{env,cwd:root,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  let logs='';app.stdout.on('data',b=>logs+=b);app.stderr.on('data',b=>logs+=b);
  for(let i=0;i<100;i++){
    if(app.exitCode!==null)throw Error('Node exited: '+logs);
    try{const r=await fetch('http://127.0.0.1:4173/api/airdrop/public/health',{headers:{origin},signal:AbortSignal.timeout(500)});
      if(r.status===200)return;}catch{}
    await delay(100);
  }throw Error('Node readiness timeout: '+logs);
}
async function stop(){
  if(app&&app.exitCode===null){const done=once(app,'exit');app.send('shutdown');await done;assert.equal(app.exitCode,0);}
}
try{
  await start();
  run(nginx,['-p',dir.replaceAll('\\','/')+'/', '-c',config,'-t']);
  edge=spawn(nginx,['-p',dir.replaceAll('\\','/')+'/', '-c',config,'-g','daemon off;'],{windowsHide:true,stdio:'ignore'});
  edge.on('error',e=>console.error(e.message));
  let health;
  for(let i=0;i<100;i++){try{health=await get('/api/airdrop/public/health');if(health.status===200)break;}catch{}await delay(100);}
  assert.equal(health?.status,200);assert.deepEqual(JSON.parse(health.data),{ready:true,version:'0.1'});
  assert.ok(['TLSv1.2','TLSv1.3'].includes(health.tls));checks.push('TLS certificate trust and SAN verification; health minimal response');
  for(const path of ['/apply.html','/apply-ui.js','/dashboard.css','/logo.png','/api/airdrop/public/status'])assert.equal((await get(path)).status,200,path);
  for(const path of ['/','/index.html','/airdrop.html','/treasury.html','/airdrop-ui.js','/api/airdrop',
    '/api/airdrop/proposal','/api/airdrop/treasury-export','/api/airdrop/devnet-batch-draft','/api/treasury',
    '/api/status','/.env','/.airdrop-data/events.jsonl','/api/airdrop/public/status/','/api%2fairdrop/public/status',
    '/x/../apply.html','//apply.html'])assert.equal((await get(path)).status,404,path);
  checks.push('Seven public paths; admin/Treasury, secrets, encoded paths denied');
  assert.equal((await get('/api/airdrop/public/status',{headers:{origin:'https://evil.invalid'}})).status,403);
  assert.equal((await get('/api/airdrop/public/applications',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await get('/api/airdrop/public/applications',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await get('/api/airdrop/public/applications')).status,403);
  checks.push('Wrong/missing POST Origin and wrong method rejected through real proxy');
  // Pace 150 requests under the unchanged 20/min edge policy (~8 minutes).
  await delay(6500);
  const child=spawn(process.execPath,['scripts/airdrop-load-staging.mjs'],{cwd:root,windowsHide:true,
    env:{...env,NODE_EXTRA_CA_CERTS:cert,AIRDROP_LOAD_CONFIRM:'STAGING_ONLY',AIRDROP_LOAD_TARGET:origin,
      AIRDROP_LOAD_ORIGIN:origin,AIRDROP_LOAD_COUNT:'150',AIRDROP_LOAD_CONCURRENCY:'1',AIRDROP_LOAD_INTERVAL_MS:'3100'},
    stdio:['ignore','pipe','inherit']});
  let output='';child.stdout.on('data',b=>output+=b);
  const [code]=await once(child,'exit');assert.equal(code,0,output);
  const load=JSON.parse(output);assert.equal(load.created,150);checks.push('150 submissions through TLS proxy at unchanged 20/min rate');
  const snapshot=JSON.parse((await get('/api/airdrop/public/status')).data);assert.equal(snapshot.total,150);
  await stop();await start();
  assert.deepEqual(JSON.parse((await get('/api/airdrop/public/status')).data),snapshot);
  checks.push('Actual Node process restart preserves total, counts and campaign');
  await stop();
  const backup=JSON.parse(run(process.execPath,['scripts/backup-airdrop-ledger.mjs'],{env:{...env,AIRDROP_BACKUP_DIR:backups}}));
  const verified=JSON.parse(run(process.execPath,['scripts/verify-airdrop-backup.mjs',backup.backup,backup.backup+'.sha256']));
  assert.equal(verified.events,150);
  // Restore into a fresh path; the live test ledger is never overwritten.
  env.AIRDROP_LEDGER_PATH=join(dir,'restored','events.jsonl');await mkdir(join(dir,'restored'));
  await copyFile(backup.backup,env.AIRDROP_LEDGER_PATH);await start();
  assert.deepEqual(JSON.parse((await get('/api/airdrop/public/status')).data),snapshot);
  checks.push('SHA-256/hash-chain backup verification and isolated restore/restart');
  // Rate flood uses invalid Origin and stores no additional applications.
  const flood=await Promise.all(Array.from({length:15},()=>get('/api/airdrop/public/applications',{
    method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'})));
  assert.ok(flood.some(x=>x.status===429));checks.push('20/min limit returns 429 on burst');
  await stop();
  const down=await get('/api/airdrop/public/health');assert.ok([502,504].includes(down.status));
  assert.equal((await get('/api/treasury')).status,404);checks.push('Backend down stays fail-closed');
  // Intact checksum alone must not make corrupt application storage ready.
  await writeFile(env.AIRDROP_LEDGER_PATH,'corrupt\n');
  app=fork(join(root,'dashboard/server.mjs'),[],{env,cwd:root,stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
  let broken;
  for(let i=0;i<100;i++){try{broken=await get('/api/airdrop/public/health');if(broken.status===503)break;}catch{}await delay(100);}
  assert.equal(broken?.status,503);assert.deepEqual(JSON.parse(broken.data),{ready:false,version:'0.1'});
  checks.push('Corrupt ledger reports 503 without details');
  const report={scope:'isolated local Nginx/TLS staging rehearsal; not remote deployment',checks,load,
    node:process.version,nginx:run(nginx,['-v']),backupEvents:verified.events};
  console.log(JSON.stringify(report,null,2));
  if(process.env.STAGING_EVIDENCE)await writeFile(process.env.STAGING_EVIDENCE,JSON.stringify(report,null,2));
}finally{
  await stop().catch(()=>{});
  if(edge)run(nginx,['-p',dir.replaceAll('\\','/')+'/', '-c',config,'-s','quit']);
  // Retain only public evidence; erase generated TLS private key after shutdown.
  await unlink(key).catch(()=>{});
}
