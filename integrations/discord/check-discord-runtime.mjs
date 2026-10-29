const required=['DISCORD_APPLICATION_ID','DISCORD_GUILD_ID','DISCORD_BOT_TOKEN','DISCORD_PUBLIC_KEY'];
const present=Object.fromEntries(required.map(k=>[k,typeof process.env[k]==='string'&&process.env[k].length>0]));
const snowflake=k=>/^\d{17,20}$/.test(process.env[k]||'');
const publicKey=/^[0-9a-fA-F]{64}$/.test(process.env.DISCORD_PUBLIC_KEY||'');
const ready=present.DISCORD_BOT_TOKEN&&snowflake('DISCORD_APPLICATION_ID')&&snowflake('DISCORD_GUILD_ID')&&publicKey;
console.log(JSON.stringify({
  ready,
  applicationIdConfigured:snowflake('DISCORD_APPLICATION_ID'),
  guildIdConfigured:snowflake('DISCORD_GUILD_ID'),
  botTokenConfigured:present.DISCORD_BOT_TOKEN,
  publicKeyConfigured:publicKey
},null,2));
if(!ready) process.exitCode=1;
