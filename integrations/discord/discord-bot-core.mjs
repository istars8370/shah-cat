// SHAH CAT Discord Bot v0.1 command core.
// No bot token, wallet signing, token transfer, or Treasury action.
export const DISCORD_COMMANDS=Object.freeze([
  Object.freeze({
    name:'airdrop',
    description:'SHAH CAT Genesis Airdrop 안내를 확인합니다.',
    options:[]
  }),
  Object.freeze({
    name:'verify',
    description:'내 Discord 계정을 기존 에어드랍 신청과 연결 확인합니다.',
    options:[
      Object.freeze({name:'application_id',description:'에어드랍 신청 ID',type:3,required:true})
    ]
  }),
  Object.freeze({
    name:'status',
    description:'내 에어드랍 신청 상태를 확인합니다.',
    options:[]
  })
]);

const EPHEMERAL=64;
const message=content=>({type:4,data:{content,flags:EPHEMERAL}});

function discordUserId(interaction){
  const id=interaction?.member?.user?.id||interaction?.user?.id;
  if(typeof id!=='string'||!/^\d{17,20}$/.test(id)) throw Object.assign(Error('Discord 사용자 ID 확인 실패'),{status:400});
  return id;
}
function option(interaction,name){
  const items=interaction?.data?.options;
  if(!Array.isArray(items)) return null;
  return items.find(x=>x?.name===name)?.value??null;
}
export async function handleDiscordInteraction(interaction,{store,campaignUrl='/apply.html'}={}){
  if(!interaction||typeof interaction!=='object') throw Object.assign(Error('Discord interaction 형식 오류'),{status:400});
  if(interaction.type===1) return {type:1};
  if(interaction.type!==2) return message('지원하지 않는 Discord interaction입니다.');
  if(!store) throw Object.assign(Error('Airdrop store가 필요합니다.'),{status:503});

  const command=interaction?.data?.name;
  if(command==='airdrop'){
    const snap=store.snapshot();
    return message(
      'SHAH CAT Genesis Airdrop\n'+
      '기간: 최대 30일 · 신청: 최대 '+snap.limits.maxApplications+'명 · 총 한도: 2,000,000 SHAH\n'+
      '신청: '+campaignUrl+'\n'+
      '가격 상승, 상장, 투자수익은 보장되지 않습니다. 개인키·시드 문구를 입력하지 마세요.'
    );
  }

  const userId=discordUserId(interaction);

  if(command==='status'){
    const status=store.statusByChannel('discord',userId);
    if(!status) return message('이 Discord 계정으로 연결된 에어드랍 신청을 찾지 못했습니다.');
    return message(
      '에어드랍 상태: '+status.status+'\n'+
      '점수: '+status.score+'\n'+
      'Discord 인증: '+(status.channelVerified?'완료':'미완료')
    );
  }

  if(command==='verify'){
    const applicationId=option(interaction,'application_id');
    if(typeof applicationId!=='string'||!applicationId.trim()) return message('application_id가 필요합니다.');
    try{
      const out=await store.verifyChannel({
        applicationId:applicationId.trim(),
        channel:'discord',
        channelUserId:userId,
        source:'discord-interaction'
      });
      return message('Discord 계정 인증 기록 완료\n신청 상태: '+out.status+'\n최종 지급 여부는 기존 심사·Treasury 승인 절차를 따릅니다.');
    }catch(error){
      if([404,409].includes(error?.status)) return message(error.message);
      throw error;
    }
  }

  return message('지원하지 않는 명령입니다. /airdrop, /verify, /status를 사용하세요.');
}
