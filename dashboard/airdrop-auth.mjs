import { timingSafeEqual } from 'node:crypto';

function safeEqual(a,b){
  const x=Buffer.from(a||'','utf8'), y=Buffer.from(b||'','utf8');
  if(x.length!==y.length || !x.length) return false;
  return timingSafeEqual(x,y);
}

export function adminConfigured(){
  return typeof process.env.AIRDROP_ADMIN_TOKEN==='string' && process.env.AIRDROP_ADMIN_TOKEN.length>=24;
}

export function requireAirdropAdmin(req){
  if(!adminConfigured()) throw Object.assign(Error('관리자 인증 토큰 설정이 필요합니다.'),{status:503});
  const header=req.headers.authorization||'';
  const match=/^Bearer ([A-Za-z0-9._~-]{24,256})$/.exec(header);
  if(!match || !safeEqual(match[1],process.env.AIRDROP_ADMIN_TOKEN)) {
    throw Object.assign(Error('관리자 인증 실패'),{status:403});
  }
}
