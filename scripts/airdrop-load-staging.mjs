// Staging-only SHAH CAT Airdrop HTTP load probe.
// Intentionally capped at 150 requests and 10 concurrent workers.
import { randomBytes } from 'node:crypto';

const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes){
  let n=0n; for(const b of bytes)n=n*256n+BigInt(b);
  let out=''; while(n){const r=Number(n%58n);out=alphabet[r]+out;n/=58n;}
  for(const b of bytes){if(b!==0)break;out='1'+out;}
  return out||'1';
}
const target=process.env.AIRDROP_LOAD_TARGET;
const origin=process.env.AIRDROP_LOAD_ORIGIN;
const confirm=process.env.AIRDROP_LOAD_CONFIRM;
const count=Math.min(150,Math.max(1,Number(process.env.AIRDROP_LOAD_COUNT||25)));
const concurrency=Math.min(10,Math.max(1,Number(process.env.AIRDROP_LOAD_CONCURRENCY||5)));

if(confirm!=='STAGING_ONLY') throw Error('Set AIRDROP_LOAD_CONFIRM=STAGING_ONLY');
if(!target||!origin) throw Error('AIRDROP_LOAD_TARGET and AIRDROP_LOAD_ORIGIN are required');
const url=new URL('/api/airdrop/public/applications',target);
if(!/^https?:$/.test(url.protocol)) throw Error('HTTP(S) target required');

let next=0;
const results=[];
async function worker(){
  while(true){
    const i=next++; if(i>=count)return;
    const wallet=base58(randomBytes(32));
    const payload={
      communityId:'load-probe-'+Date.now()+'-'+i,
      wallet,
      evidenceUrl:'https://probe-'+i+'.example.invalid/evidence',
      submittedAt:new Date().toISOString(),
      activities:['join'],
      flags:[]
    };
    const started=performance.now();
    try{
      const response=await fetch(url,{
        method:'POST',
        headers:{origin,'content-type':'application/json'},
        body:JSON.stringify(payload),
        signal:AbortSignal.timeout(10000)
      });
      results.push({status:response.status,ms:performance.now()-started});
      await response.arrayBuffer();
    }catch(error){results.push({status:'ERR',ms:performance.now()-started,error:error.name});}
  }
}
await Promise.all(Array.from({length:concurrency},()=>worker()));
const ok=results.filter(x=>x.status===201).length;
const reviewOrReject=results.filter(x=>x.status===201).length-ok;
const errors=results.filter(x=>x.status==='ERR'||Number(x.status)>=500).length;
const times=results.map(x=>x.ms).sort((a,b)=>a-b);
const p=n=>times[Math.min(times.length-1,Math.floor(times.length*n))]||0;
console.log(JSON.stringify({target:url.origin,count,concurrency,created:ok,reviewOrReject,errors,p50ms:Math.round(p(.5)),p95ms:Math.round(p(.95)),maxMs:Math.round(times.at(-1)||0)},null,2));
if(errors) process.exitCode=1;
