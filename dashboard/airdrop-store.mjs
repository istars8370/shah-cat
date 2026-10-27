// SHAH CAT Airdrop v0.1 local append-only application ledger.
// No private keys, signing, broadcasting, custody or token movement.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { classifyApplications, buildPayoutPlan, GENESIS_AIRDROP } from './airdrop-engine.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
function fail(message, status=400){ throw Object.assign(Error(message),{status}); }

export class AirdropStore {
  static async open({path, startsAt, clock=()=>Date.now()}){
    const s=new AirdropStore();
    s.path=path; s.startsAt=startsAt; s.clock=clock; s.events=[]; s.apps=new Map(); s.tail=Promise.resolve();
    await mkdir(dirname(path),{recursive:true,mode:0o700});
    s.lock=await open(path+'.lock','wx',0o600);
    try{
      await s.lock.writeFile(String(process.pid));
      let data;
      try{data=await readFile(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
      if(data!==undefined){
        if(data && !data.endsWith('\n')) fail('에어드랍 원장 끝 손상',503);
        for(const line of data.trim()?data.trimEnd().split('\n'):[]){
          const event=JSON.parse(line), {digest,...body}=event;
          if(body.seq!==s.events.length || body.prev!==(s.events.at(-1)?.digest??null) || hash(body)!==digest) fail('에어드랍 원장 무결성 오류',503);
          s.events.push(event);
          if(body.application) s.apps.set(body.application.id,body.application);
        }
      }
      s.handle=await open(path,'a',0o600);
      return s;
    }catch(e){await s.close();throw e;}
  }
  async close(){
    this.closing=true; await this.tail?.catch(()=>{}); await this.handle?.close(); await this.lock?.close();
    if(this.lock){await unlink(this.path+'.lock').catch(()=>{});this.lock=null;}
  }
  exclusive(fn){
    const n=this.tail.then(()=>{if(this.closing||!this.lock)fail('에어드랍 원장 쓰기 중단',503);return fn();});
    this.tail=n.catch(()=>{});return n;
  }
  async append(type,application){
    const body={seq:this.events.length,prev:this.events.at(-1)?.digest??null,at:new Date(this.clock()).toISOString(),type,application};
    const event={...body,digest:hash(body)};
    await this.handle.writeFile(JSON.stringify(event)+'\n'); await this.handle.sync();
    this.events.push(event); if(application)this.apps.set(application.id,application);
  }
  snapshot(){
    const applications=[...this.apps.values()].map(clone);
    const counts={PASS:0,REVIEW:0,REJECT:0};
    for(const x of applications) if(Object.hasOwn(counts,x.status)) counts[x.status]++;
    const proposedRaw=applications.reduce((n,x)=>n+BigInt(x.proposedRaw||'0'),0n);
    return {enabled:true,version:'0.1',startsAt:this.startsAt,limits:{
      durationDays:GENESIS_AIRDROP.durationDays,maxApplications:GENESIS_AIRDROP.maxApplications,
      dailyApplicationCap:GENESIS_AIRDROP.dailyApplicationCap,totalBudgetRaw:String(GENESIS_AIRDROP.totalBudgetRaw),
      dailyPayoutCapRaw:String(GENESIS_AIRDROP.dailyPayoutCapRaw)
    },counts,total:applications.length,proposedRaw:String(proposedRaw),applications,events:clone(this.events)};
  }
  submit(input){return this.exclusive(async()=>{
    const existing=[...this.apps.values()];
    const now=this.clock();
    const day=new Date(now).toISOString().slice(0,10);
    const today=existing.filter(x=>x.createdAt.slice(0,10)===day && x.status!=='REJECT').length;
    const allocatedRaw=existing.reduce((n,x)=>n+BigInt(x.proposedRaw||'0'),0n);
    const classified=classifyApplications([input],{startsAt:this.startsAt,now,existingApplications:existing.length,todayAccepted:today,allocatedRaw})[0];
    if(classified.application){
      if(existing.some(x=>x.wallet===classified.application.wallet)) classified.status='REJECT',classified.reason='기존 원장 중복 지갑';
      if(existing.some(x=>x.communityId===classified.application.communityId)) classified.status='REJECT',classified.reason='기존 원장 중복 커뮤니티 ID';
      if(classified.application.evidenceUrl && existing.some(x=>x.evidenceUrl===classified.application.evidenceUrl)) classified.status='REJECT',classified.reason='기존 원장 중복 증빙';
    }
    const application={id:randomUUID(),createdAt:new Date(now).toISOString(),status:classified.status,reason:classified.reason,score:classified.score,
      communityId:classified.application?.communityId??null,wallet:classified.application?.wallet??null,evidenceUrl:classified.application?.evidenceUrl??null,
      activities:classified.application?.activities??[],flags:classified.application?.flags??[],proposedRaw:'0'};
    await this.append('submit',application); return clone(application);
  });}
  propose(){
    const rows=[...this.apps.values()].map(x=>({status:x.status,score:x.score,application:{wallet:x.wallet,communityId:x.communityId}}));
    const used=[...this.apps.values()].reduce((n,x)=>n+BigInt(x.proposedRaw||'0'),0n);
    const plan=buildPayoutPlan(rows,{remainingBudgetRaw:GENESIS_AIRDROP.totalBudgetRaw-used});
    return {totalRaw:String(plan.totalRaw),totalSHAH:plan.totalSHAH,requiresHumanApproval:true,transactionCreated:false,
      payouts:plan.payouts.map(x=>({...x,amountRaw:String(x.amountRaw)}))};
  }
  treasuryExport(){
    const plan=this.propose();
    return {format:'SHAH_CAT_AIRDROP_TREASURY_EXPORT_V1',network:'devnet',campaign:'genesis-v1',automaticExecution:false,
      note:'Proposal only. Create individual Treasury spend requests only after a valid approved budget exists.',
      payouts:plan.payouts.map(x=>({kind:'spend',recipient:x.wallet,amountRaw:x.amountRaw,purpose:'Genesis Community Airdrop reward',
        evidence:'Airdrop v0.1 approved application: '+x.communityId,conflicts:[],budgetId:null}))};
  }
}
