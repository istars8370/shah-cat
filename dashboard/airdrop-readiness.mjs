import { adminConfigured } from './airdrop-auth.mjs';

function validOrigin(value){
  if(!value) return false;
  try{
    const u=new URL(value);
    return u.origin===value && ['https:','http:'].includes(u.protocol);
  }catch{return false;}
}
function validStart(value){
  const ms=Date.parse(value||'');
  return Number.isFinite(ms) && new Date(ms).toISOString()===value;
}
export function airdropReadiness(env=process.env){
  const issues=[];
  if(!validStart(env.AIRDROP_STARTS_AT)) issues.push('AIRDROP_STARTS_AT');
  if(!validOrigin(env.AIRDROP_PUBLIC_ORIGIN)) issues.push('AIRDROP_PUBLIC_ORIGIN');
  const token=env.AIRDROP_ADMIN_TOKEN;
  if(typeof token!=='string'||token.length<24) issues.push('AIRDROP_ADMIN_TOKEN');
  return {
    ready:issues.length===0,
    version:'0.1',
    campaignConfigured:validStart(env.AIRDROP_STARTS_AT),
    publicOriginConfigured:validOrigin(env.AIRDROP_PUBLIC_ORIGIN),
    adminAuthConfigured:typeof token==='string'&&token.length>=24,
    issues
  };
}
