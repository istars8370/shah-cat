import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AirdropStore } from './airdrop-store.mjs';
import { verifyDiscordRequest } from '../integrations/discord/discord-interaction-auth.mjs';
import { handleDiscordInteraction } from '../integrations/discord/discord-bot-core.mjs';

const startsAt='2026-10-28T00:00:00.000Z';
const wallet='3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs';
const discordId='123456789012345678';

test('Discord interaction signature verification accepts valid Ed25519 request',()=>{
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const der=publicKey.export({format:'der',type:'spki'});
  const raw=der.subarray(-32).toString('hex');
  const timestamp='1761700000';
  const body=Buffer.from('{"type":1}');
  const signature=sign(null,Buffer.concat([Buffer.from(timestamp),body]),privateKey).toString('hex');
  assert.equal(verifyDiscordRequest({publicKeyHex:raw,signatureHex:signature,timestamp,body}),true);
  assert.throws(()=>verifyDiscordRequest({publicKeyHex:raw,signatureHex:signature,timestamp,body:Buffer.from('x')}),/검증 실패/);
});

test('Discord slash commands use the authenticated Discord user id',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-discord-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    let tick=Date.parse('2026-10-29T00:00:00.000Z');
    store=await AirdropStore.open({path,startsAt,clock:()=>{const x=tick;tick+=2000;return x;}});
    const app=await store.submit({
      communityId:'discord-member',
      wallet,
      channel:'discord',
      channelUserId:discordId,
      evidenceUrl:'https://discord.com/channels/1/2/3',
      submittedAt:'2026-10-29T00:00:00.000Z',
      activities:['discordJoin'],
      flags:[]
    });
    const before=await handleDiscordInteraction({type:2,data:{name:'status'},member:{user:{id:discordId}}},{store});
    assert.match(before.data.content,/미완료/);

    const verified=await handleDiscordInteraction({
      type:2,
      data:{name:'verify',options:[{name:'application_id',value:app.id}]},
      member:{user:{id:discordId}}
    },{store});
    assert.match(verified.data.content,/인증 기록 완료/);

    const after=await handleDiscordInteraction({type:2,data:{name:'status'},member:{user:{id:discordId}}},{store});
    assert.match(after.data.content,/완료/);
    assert.equal(after.data.flags,64);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});

test('Discord verify cannot claim another application identity',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-discord-'));
  const path=join(dir,'events.jsonl');
  let store;
  try{
    store=await AirdropStore.open({path,startsAt,clock:()=>Date.parse('2026-10-29T00:00:00.000Z')});
    const app=await store.submit({
      communityId:'discord-member',
      wallet,
      channel:'discord',
      channelUserId:discordId,
      evidenceUrl:'https://discord.com/channels/1/2/3',
      submittedAt:'2026-10-29T00:00:00.000Z',
      activities:['discordJoin'],
      flags:[]
    });
    const response=await handleDiscordInteraction({
      type:2,
      data:{name:'verify',options:[{name:'application_id',value:app.id}]},
      member:{user:{id:'223456789012345678'}}
    },{store});
    assert.match(response.data.content,/일치하지 않습니다/);
  }finally{await store?.close();await rm(dir,{recursive:true,force:true});}
});
