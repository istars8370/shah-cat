// Foreground Windows/Linux supervisor. Run via a dedicated restricted OS account.
// Config lives outside the checkout/web root; no credentials in command arguments.
import { readFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fork, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import net from 'node:net';
import { airdropReadiness } from '../dashboard/airdrop-readiness.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Supply absolute private runtime config JSON path');
const c=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));
if(c.environment!=='staging')throw Error('Staging config required');
const u=new URL(c.origin);
if(u.protocol!=='https:'||u.origin!==c.origin)throw Error('Exact HTTPS origin required');
const env={...process.env,PORT:'4173',AIRDROP_STARTS_AT:c.startsAt,AIRDROP_PUBLIC_ORIGIN:c.origin,
  AIRDROP_ADMIN_TOKEN:c.adminToken,AIRDROP_LEDGER_PATH:resolve(c.ledgerPath)};
if(!airdropReadiness(env).ready)throw Error('Invalid staging runtime configuration');
const probe=net.createServer();
await new Promise((ok,no)=>probe.once('error',no).listen(4173,'127.0.0.1',ok));
await new Promise(ok=>probe.close(ok));
await mkdir(dirname(env.AIRDROP_LEDGER_PATH),{recursive:true});
// Unknown stale lock must be investigated by an operator, never deleted here.
try{await access(env.AIRDROP_LEDGER_PATH+'.lock');throw Error('Existing ledger lock: stop and investigate');}
catch(e){if(e.code!=='ENOENT')throw e;}
const args=['-p',resolve(c.nginxPrefix).replaceAll('\\','/')+'/', '-c',resolve(c.nginxConfig).replaceAll('\\','/')];
const valid=spawnSync(c.nginxExe,[...args,'-t'],{stdio:'inherit',windowsHide:true});
if(valid.status!==0)throw Error('Nginx configuration check failed');
let edge,app,stopping=false;
async function stop(code=0){
  if(stopping)return;stopping=true;
  if(edge)spawnSync(c.nginxExe,[...args,'-s','quit'],{stdio:'ignore',windowsHide:true});
  if(app&&app.exitCode===null){const done=once(app,'exit');app.send('shutdown');await done;}
  process.exitCode=code;
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
app=fork(join(root,'dashboard/server.mjs'),[],{env,cwd:root,windowsHide:true,stdio:['ignore','inherit','inherit','ipc']});
app.on('error',()=>stop(1));app.on('exit',()=>{if(!stopping)stop(1);});
try{
  let ready=false;
  for(let i=0;i<50;i++){
    try{const r=await fetch('http://127.0.0.1:4173/api/airdrop/public/health',{headers:{origin:c.origin},signal:AbortSignal.timeout(500)});
      if(r.ok&&(await r.json()).ready){ready=true;break;}}catch{}
    await new Promise(ok=>setTimeout(ok,200));
  }
  if(!ready)throw Error('Ledger or readiness check failed; edge not started');
  edge=spawn(c.nginxExe,[...args,'-g','daemon off;'],{stdio:'inherit',windowsHide:true});
  edge.on('error',()=>stop(1));edge.on('exit',()=>{if(!stopping)stop(1);});
  console.log('Staging ready. Ctrl+C gracefully closes ingress and ledger.');
}catch{await stop(1);throw Error('Staging startup failed');}
