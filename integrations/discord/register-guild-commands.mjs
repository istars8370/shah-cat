import { DISCORD_COMMANDS } from './discord-bot-core.mjs';

const token=process.env.DISCORD_BOT_TOKEN;
const applicationId=process.env.DISCORD_APPLICATION_ID;
const guildId=process.env.DISCORD_GUILD_ID;
const confirm=process.env.DISCORD_REGISTER_CONFIRM;

function id(value,name){
  if(typeof value!=='string'||!/^\d{17,20}$/.test(value)) throw Error(name+' is required and must be a Discord snowflake ID');
  return value;
}
id(applicationId,'DISCORD_APPLICATION_ID');
id(guildId,'DISCORD_GUILD_ID');
if(typeof token!=='string'||token.length<20) throw Error('DISCORD_BOT_TOKEN is required');
if(confirm!=='REGISTER_GUILD_COMMANDS'){
  console.log(JSON.stringify({
    ready:true,
    dryRun:true,
    guildId,
    applicationId,
    commands:DISCORD_COMMANDS.map(x=>x.name),
    message:'Set DISCORD_REGISTER_CONFIRM=REGISTER_GUILD_COMMANDS to register guild commands.'
  },null,2));
  process.exit(0);
}

const url='https://discord.com/api/v10/applications/'+applicationId+'/guilds/'+guildId+'/commands';
const results=[];
for(const command of DISCORD_COMMANDS){
  const response=await fetch(url,{
    method:'POST',
    headers:{authorization:'Bot '+token,'content-type':'application/json','user-agent':'SHAH-CAT-Airdrop/0.1'},
    body:JSON.stringify(command),
    signal:AbortSignal.timeout(15000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw Error('Discord command registration failed: HTTP '+response.status+' '+(data.message||''));
  results.push({id:data.id,name:data.name,version:data.version});
}
console.log(JSON.stringify({registered:true,guildId,applicationId,commands:results},null,2));
