// Safe channel adapters. No external API calls, tokens or credentials.
function text(value,name,max=120){
  if(typeof value!=='string'||!value.trim()||value.length>max) throw Error(name+' 입력 오류');
  return value.trim();
}
export function discordApplication(input){
  const discordUserId=text(input.discordUserId,'Discord 사용자 ID',20);
  if(!/^\d{17,20}$/.test(discordUserId)) throw Error('Discord 사용자 ID 형식 오류');
  return {
    communityId:text(input.communityId,'커뮤니티 ID'),
    wallet:text(input.wallet,'지갑',64),
    channel:'discord',
    channelUserId:discordUserId,
    evidenceUrl:input.evidenceUrl||null,
    submittedAt:input.submittedAt,
    activities:Array.isArray(input.activities)?input.activities:[],
    flags:Array.isArray(input.flags)?input.flags:[],
  };
}
export function naverCafeApplication(input){
  return {
    communityId:text(input.communityId,'커뮤니티 ID'),
    wallet:text(input.wallet,'지갑',64),
    channel:'naver',
    channelUserId:text(input.naverId,'네이버카페 계정 식별자'),
    evidenceUrl:input.evidenceUrl||null,
    submittedAt:input.submittedAt,
    activities:Array.isArray(input.activities)?input.activities:[],
    flags:Array.isArray(input.flags)?input.flags:[],
  };
}
