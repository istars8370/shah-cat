import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AirdropStore } from './airdrop-store.mjs';
import { requireAirdropAdmin } from './airdrop-auth.mjs';

let defaultStore;
export function defaultAirdropStore(){
  if(!defaultStore) defaultStore=(async()=>{
    const startsAt=process.env.AIRDROP_STARTS_AT;
    if(!startsAt) return null;
    const path=join(dirname(fileURLToPath(import.meta.url)),'.airdrop-data','events.jsonl');
    return AirdropStore.open({path,startsAt});
  })();
  return defaultStore;
}
function fail(message,status=400){throw Object.assign(Error(message),{status});}
async function body(req){
  const chunks=[];let length=0;
  for await(const chunk of req){
    length+=chunk.length;
    if(length>32768)fail('요청 크기 초과',413);
    chunks.push(Buffer.from(chunk));
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('JSON 형식 오류',400);}
}
export async function airdropAPI(req,res,getStore=defaultAirdropStore){
  const host=req.headers.host||'';
  if(!/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(host))fail('로컬 Host만 허용합니다.',403);
  const url=new URL(req.url,'http://'+host);
  const json=(status,data)=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(data));
  };
  if(!['GET','POST'].includes(req.method))return json(405,{error:'GET / POST only'});
  if(req.method==='POST'&&(req.headers.origin!=='http://'+host||req.headers['content-type']?.split(';')[0].trim()!=='application/json'))fail('동일 출처 JSON 요청만 허용합니다.',403);
  const store=await getStore();
  if(req.method==='GET'&&url.pathname==='/api/airdrop')return json(200,store?store.snapshot():{enabled:false,version:'0.1',message:'AIRDROP_STARTS_AT 설정 후 서버를 다시 시작하세요.'});
  if(!store)fail('에어드랍 시작 시각 설정이 필요합니다.',409);
  if(req.method==='POST'&&url.pathname==='/api/airdrop/applications')return json(201,await store.submit(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/airdrop/review'){requireAirdropAdmin(req);return json(200,await store.review(await body(req)));}
  if(req.method==='POST'&&url.pathname==='/api/airdrop/devnet-batch-draft'){requireAirdropAdmin(req);return json(200,store.devnetBatchDraft(await body(req)));}
  if(req.method==='GET'&&url.pathname==='/api/airdrop/proposal'){requireAirdropAdmin(req);return json(200,store.propose());}
  if(req.method==='GET'&&url.pathname==='/api/airdrop/treasury-export'){requireAirdropAdmin(req);return json(200,store.treasuryExport());}
  return json(404,{error:'Not found'});
}
