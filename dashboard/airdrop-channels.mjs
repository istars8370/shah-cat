// Community-channel rules for SHAH CAT Airdrop v0.1.
export const CHANNELS=Object.freeze({
  naver:Object.freeze({
    id:'naver',
    label:'Naver Cafe',
    evidenceHosts:Object.freeze(['cafe.naver.com','m.cafe.naver.com']),
    requireUserId:true,
  }),
  discord:Object.freeze({
    id:'discord',
    label:'Discord',
    evidenceHosts:Object.freeze(['discord.com','ptb.discord.com','canary.discord.com']),
    requireUserId:true,
  }),
  github:Object.freeze({
    id:'github',
    label:'GitHub',
    evidenceHosts:Object.freeze(['github.com']),
    requireUserId:false,
  }),
  other:Object.freeze({
    id:'other',
    label:'Other',
    evidenceHosts:Object.freeze([]),
    requireUserId:false,
  }),
});

export const CHANNEL_ACTIVITY_SCORE=Object.freeze({
  naverCafeJoin:1,
  naverCafePost:3,
  naverCafeHelpfulReply:2,
  discordJoin:1,
  discordVerified:2,
  discordHelpfulReply:2,
  discordTestParticipation:5,
});

function fail(message){throw Object.assign(Error(message),{code:'AIRDROP_CHANNEL'});}
export function normalizeChannel(input){
  const id=typeof input?.channel==='string'&&input.channel.trim()?input.channel.trim():'other';
  if(!Object.hasOwn(CHANNELS,id)) fail('지원하지 않는 커뮤니티 채널');
  const cfg=CHANNELS[id];
  const channelUserId=input?.channelUserId==null?'':String(input.channelUserId).trim();
  if(cfg.requireUserId&&!channelUserId) fail(cfg.label+' 계정 식별자가 필요합니다.');
  if(channelUserId.length>120) fail('채널 계정 식별자 길이 오류');
  if(id==='discord'&&!/^\d{17,20}$/.test(channelUserId)) fail('Discord 사용자 ID는 17~20자리 숫자여야 합니다.');
  return {channel:id,channelUserId:channelUserId||null};
}

export function channelEvidenceStatus({channel,evidenceUrl}){
  const cfg=CHANNELS[channel]||CHANNELS.other;
  if(!evidenceUrl||!cfg.evidenceHosts.length) return {ok:true,review:false,reason:null};
  const host=new URL(evidenceUrl).hostname.toLowerCase();
  const ok=cfg.evidenceHosts.includes(host);
  return ok?{ok:true,review:false,reason:null}:{ok:false,review:true,reason:cfg.label+' 증빙 도메인 수동 확인'};
}
