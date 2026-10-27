import { defaultAirdropStore } from './airdrop-api.mjs';

function fail(message,status=400){throw Object.assign(Error(message),{status});}
async function body(req){
  const chunks=[]; let length=0;
  for await(const chunk of req){
    length+=chunk.length;
    if(length>32768) fail('요청 크기 초과',413);
    chunks.push(Buffer.from(chunk));
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('JSON 형식 오류',400);}
}
function allowedOrigin(req){
  const configured=process.env.AIRDROP_PUBLIC_ORIGIN;
  if(!configured) fail('공개 Origin 설정이 필요합니다.',503);
  let expected;
  try{expected=new URL(configured).origin;}catch{fail('공개 Origin 설정 오류',503);}
  if(req.headers.origin!==expected) fail('허용되지 않은 Origin입니다.',403);
  return expected;
}
export async function airdropPublicAPI(req,res,getStore=defaultAirdropStore){
  const url=new URL(req.url,'http://127.0.0.1');
  const json=(status,data,origin)=>{
    const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
    if(origin) headers['access-control-allow-origin']=origin;
    res.writeHead(status,headers); res.end(JSON.stringify(data));
  };
  if(req.method==='OPTIONS'){
    const origin=allowedOrigin(req);
    res.writeHead(204,{
      'access-control-allow-origin':origin,
      'access-control-allow-methods':'GET, POST, OPTIONS',
      'access-control-allow-headers':'content-type',
      'access-control-max-age':'600',
      'cache-control':'no-store'
    });
    return res.end();
  }
  if(!['GET','POST'].includes(req.method)) return json(405,{error:'GET / POST only'});
  const origin=allowedOrigin(req);
  const store=await getStore();
  if(!store) fail('에어드랍 시작 시각 설정이 필요합니다.',409);
  if(req.method==='GET'&&url.pathname==='/api/airdrop/public/status'){
    const s=store.snapshot();
    return json(200,{
      enabled:true,version:s.version,startsAt:s.startsAt,total:s.total,counts:s.counts,
      limits:s.limits,automaticExecution:false
    },origin);
  }
  if(req.method==='POST'&&url.pathname==='/api/airdrop/public/applications'){
    if(req.headers['content-type']?.split(';')[0].trim()!=='application/json') fail('JSON 요청만 허용합니다.',403);
    const out=await store.submit(await body(req));
    return json(201,{id:out.id,status:out.status,reason:out.reason,score:out.score},origin);
  }
  return json(404,{error:'Not found'},origin);
}
