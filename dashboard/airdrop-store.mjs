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
      if(classified.application.channelUserId && existing.some(x=>x.channel===classified.application.channel && x.channelUserId===classified.application.channelUserId)) classified.status='REJECT',classified.reason='기존 원장 중복 채널 계정';
      if(classified.application.evidenceUrl && existing.some(x=>x.evidenceUrl===classified.application.evidenceUrl)) classified.status='REJECT',classified.reason='기존 원장 중복 증빙';
      if(classified.status!=='REJECT' && classified.application.evidenceUrl){
        const host=new URL(classified.application.evidenceUrl).hostname.toLowerCase();
        const recentDomain=existing.filter(x=>x.evidenceUrl && new URL(x.evidenceUrl).hostname.toLowerCase()===host && now-Date.parse(x.createdAt)<10*60*1000).length;
        if(recentDomain>=4) classified.status='REVIEW',classified.reason='짧은 시간 동일 증빙 도메인 집중';
      }
      if(classified.status!=='REJECT' && existing.length){
        const latest=existing.at(-1);
        if(now-Date.parse(latest.createdAt)<1500) classified.status='REVIEW',classified.reason='비정상적으로 빠른 연속 신청';
      }
    }
    const application={id:randomUUID(),createdAt:new Date(now).toISOString(),status:classified.status,reason:classified.reason,score:classified.score,
      communityId:classified.application?.communityId??null,wallet:classified.application?.wallet??null,
      channel:classified.application?.channel??'other',channelUserId:classified.application?.channelUserId??null,
      evidenceUrl:classified.application?.evidenceUrl??null,
      activities:classified.application?.activities??[],flags:classified.application?.flags??[],proposedRaw:'0'};
    await this.append('submit',application); return clone(application);
  });}
  verifyChannel(input){return this.exclusive(async()=>{
    if(!input||typeof input!=='object'||Array.isArray(input)) fail('채널 인증 입력 오류');
    const {applicationId,channel,channelUserId,source}=input;
    if(typeof applicationId!=='string'||!applicationId) fail('신청 ID 오류');
    if(!['discord','naver'].includes(channel)) fail('채널 인증 종류 오류');
    if(typeof channelUserId!=='string'||!channelUserId.trim()||channelUserId.length>120) fail('채널 계정 식별자 오류');
    if(typeof source!=='string'||!source.trim()||source.length>120) fail('인증 출처 오류');
    const old=this.apps.get(applicationId);
    if(!old) fail('신청을 찾을 수 없습니다.',404);
    if(old.channel!==channel||old.channelUserId!==channelUserId.trim()) fail('신청 정보와 채널 계정이 일치하지 않습니다.',409);
    if(old.channelVerifiedAt) fail('이미 채널 인증이 기록되었습니다.',409);
    const application={...old,channelVerifiedAt:new Date(this.clock()).toISOString(),channelVerificationSource:source.trim()};
    await this.append('channel-verify',application);
    return {id:application.id,status:application.status,channel:application.channel,channelVerifiedAt:application.channelVerifiedAt};
  });}
  statusByChannel(channel,channelUserId){
    const found=[...this.apps.values()].filter(x=>x.channel===channel&&x.channelUserId===channelUserId).at(-1);
    if(!found) return null;
    return {id:found.id,status:found.status,reason:found.reason,score:found.score,channelVerified:!!found.channelVerifiedAt};
  }
  review(input){return this.exclusive(async()=>{
    if(!input||typeof input!=='object'||Array.isArray(input)) fail('심사 입력 오류');
    const {id,decision,note}=input;
    if(typeof id!=='string'||!id) fail('신청 ID 오류');
    if(!['approve','reject'].includes(decision)) fail('심사 결정 오류');
    if(typeof note!=='string'||!note.trim()||note.length>500) fail('심사 메모 오류');
    const old=this.apps.get(id);
    if(!old) fail('신청을 찾을 수 없습니다.',404);
    if(old.status!=='REVIEW') fail('REVIEW 상태만 심사할 수 있습니다.',409);
    const application={...old,status:decision==='approve'?'PASS':'REJECT',
      reason:decision==='approve'?'관리자 검토 승인':'관리자 검토 거절',
      reviewedAt:new Date(this.clock()).toISOString(),reviewNote:note.trim()};
    await this.append(decision==='approve'?'review-approve':'review-reject',application);
    return clone(application);
  });}
  payoutEligible(x){
    if(x.status!=='PASS'||!Number.isInteger(x.score)||x.score<=0) return false;
    if(['discord','naver'].includes(x.channel)&&!x.channelVerifiedAt) return false;
    return true;
  }
  propose(){
    const rows=[...this.apps.values()].map(x=>({status:this.payoutEligible(x)?'PASS':'HOLD',score:x.score,application:{wallet:x.wallet,communityId:x.communityId,channel:x.channel,channelUserId:x.channelUserId}}));
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
  devnetBatchDraft({budgetId,feeCapLamports='5000',startsAt,expiresAt}={}){
    if(typeof budgetId!=='string'||!budgetId.trim()||budgetId.length>80) fail('승인된 Treasury 예산 ID가 필요합니다.',409);
    if(!/^\d+$/.test(String(feeCapLamports))||BigInt(feeCapLamports)<0n) fail('수수료 상한 오류');
    const start=Date.parse(startsAt||''), end=Date.parse(expiresAt||'');
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start) fail('배치 유효기간 오류');
    const plan=this.propose();
    const fingerprint=hash({
      campaign:'genesis-v1',
      budgetId:budgetId.trim(),
      startsAt:new Date(start).toISOString(),
      expiresAt:new Date(end).toISOString(),
      payouts:plan.payouts.map(x=>({wallet:x.wallet,amountRaw:x.amountRaw,communityId:x.communityId}))
    });
    return {
      format:'SHAH_CAT_AIRDROP_DEVNET_BATCH_DRAFT_V1',
      batchId:'airdrop-'+fingerprint.slice(0,16),
      network:'devnet',
      campaign:'genesis-v1',
      budgetId:budgetId.trim(),
      payoutCount:plan.payouts.length,
      totalRaw:plan.totalRaw,
      totalSHAH:plan.totalSHAH,
      requiresTreasuryApproval:true,
      transactionCreated:false,
      signed:false,
      broadcast:false,
      requests:plan.payouts.map(x=>({
        kind:'spend',
        purpose:'Genesis Community Airdrop reward',
        evidence:'Airdrop v0.1 approved application: '+x.communityId,
        amountRaw:x.amountRaw,
        feeCapLamports:String(feeCapLamports),
        startsAt:new Date(start).toISOString(),
        expiresAt:new Date(end).toISOString(),
        recipient:x.wallet,
        conflicts:[],
        budgetId:budgetId.trim()
      }))
    };
  }
}
