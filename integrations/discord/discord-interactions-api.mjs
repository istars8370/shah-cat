import { defaultAirdropStore } from '../../dashboard/airdrop-api.mjs';
import { verifyDiscordRequest } from './discord-interaction-auth.mjs';
import { handleDiscordInteraction } from './discord-bot-core.mjs';

function fail(message,status=400){throw Object.assign(Error(message),{status});}
async function rawBody(req){
  const chunks=[];let length=0;
  for await(const chunk of req){
    length+=chunk.length;
    if(length>32768) fail('Discord 요청 크기 초과',413);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
export async function discordInteractionsAPI(req,res,getStore=defaultAirdropStore){
  const json=(status,data)=>{
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(data));
  };
  if(req.method!=='POST') return json(405,{error:'POST only'});
  const body=await rawBody(req);
  verifyDiscordRequest({
    publicKeyHex:process.env.DISCORD_PUBLIC_KEY,
    signatureHex:req.headers['x-signature-ed25519'],
    timestamp:req.headers['x-signature-timestamp'],
    body
  });
  let interaction;
  try{interaction=JSON.parse(body.toString('utf8'));}catch{fail('Discord JSON 형식 오류',400);}
  const store=await getStore();
  if(!store) fail('Airdrop store가 준비되지 않았습니다.',503);
  return json(200,await handleDiscordInteraction(interaction,{store,campaignUrl:process.env.AIRDROP_PUBLIC_ORIGIN?process.env.AIRDROP_PUBLIC_ORIGIN+'/apply.html':'/apply.html'}));
}
