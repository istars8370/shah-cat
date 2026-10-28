// Bounded staging-only load probe. No keys or chain operations.
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes){
  let n=0n;for(const b of bytes)n=n*256n+BigInt(b);
  let out='';while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}
  for(const b of bytes){if(b!==0)break;out='1'+out;}
  return out||'1';
}
function integer(name,fallback,min,max){
  const n=Number(process.env[name]??fallback);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(name+' must be an integer in '+min+'..'+max);
  return n;
}
if(process.env.AIRDROP_LOAD_CONFIRM!=='STAGING_ONLY')throw Error('Set AIRDROP_LOAD_CONFIRM=STAGING_ONLY');
const target=new URL(process.env.AIRDROP_LOAD_TARGET);
const origin=process.env.AIRDROP_LOAD_ORIGIN;
if(!/^https?:$/.test(target.protocol)||target.origin!==origin||target.username||target.password)throw Error('Target and exact Origin must match');
if(target.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(target.hostname))throw Error('Remote staging requires TLS');
const count=integer('AIRDROP_LOAD_COUNT',25,1,150);
const concurrency=integer('AIRDROP_LOAD_CONCURRENCY',1,1,10);
const interval=integer('AIRDROP_LOAD_INTERVAL_MS',3100,0,60000);
const url=new URL('/api/airdrop/public/applications',target);
const health=await fetch(new URL('/api/airdrop/public/health',target),{headers:{origin},redirect:'error',signal:AbortSignal.timeout(10000)});
if(!health.ok||(await health.json()).ready!==true)throw Error('Staging health is not ready');
let next=0,slot=0;
const results=[],run=randomBytes(8).toString('hex');
async function worker(){
  while(true){
    const i=next++;if(i>=count)return;
    const wait=Math.max(0,slot-Date.now());slot=Math.max(slot,Date.now())+interval;
    if(wait)await delay(wait);
    const started=performance.now();
    try{
      const r=await fetch(url,{method:'POST',redirect:'error',headers:{origin,'content-type':'application/json'},
        body:JSON.stringify({communityId:'load-'+run+'-'+i,wallet:base58(randomBytes(32)),
          evidenceUrl:'https://probe-'+i+'.example.invalid/evidence',submittedAt:new Date().toISOString(),activities:['join'],flags:[]}),
        signal:AbortSignal.timeout(10000)});
      let data={};try{data=await r.json();}catch{}
      const valid=r.status===201&&['PASS','REVIEW','REJECT'].includes(data.status)&&
        typeof data.id==='string'&&Object.keys(data).sort().join(',')==='id,reason,score,status';
      results.push({status:r.status,decision:data.status,valid,ms:performance.now()-started});
    }catch(e){results.push({status:'ERR',valid:false,ms:performance.now()-started,error:e.name});}
    if(results.length%25===0)console.error('Staging probe: '+results.length+'/'+count);
  }
}
await Promise.all(Array.from({length:concurrency},worker));
const times=results.map(x=>x.ms).sort((a,b)=>a-b);
const p=n=>Math.round(times[Math.max(0,Math.ceil(times.length*n)-1)]||0);
const summary={target:target.origin,count,concurrency,intervalMs:interval,
  created:results.filter(x=>x.valid).length,
  decisions:Object.fromEntries(['PASS','REVIEW','REJECT'].map(s=>[s,results.filter(x=>x.valid&&x.decision===s).length])),
  httpStatuses:results.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),
  errors:results.filter(x=>!x.valid).length,p50ms:p(.5),p95ms:p(.95),maxMs:p(1)};
console.log(JSON.stringify(summary,null,2));
if(summary.errors||summary.created!==count)process.exitCode=1;
