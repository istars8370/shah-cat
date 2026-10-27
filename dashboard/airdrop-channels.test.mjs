import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChannel, channelEvidenceStatus, CHANNEL_ACTIVITY_SCORE } from './airdrop-channels.mjs';
import { validateApplication, scoreApplication } from './airdrop-engine.mjs';

const wallet='3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs';
const base={
  communityId:'member',
  wallet,
  submittedAt:'2026-10-29T00:00:00.000Z',
  flags:[]
};

test('Naver Cafe submission accepts cafe.naver.com evidence',()=>{
  const app=validateApplication({...base,channel:'naver',channelUserId:'naver-member',evidenceUrl:'https://cafe.naver.com/example/123',activities:['naverCafePost']});
  assert.equal(app.channel,'naver');
  assert.equal(channelEvidenceStatus(app).review,false);
  assert.equal(scoreApplication(app),CHANNEL_ACTIVITY_SCORE.naverCafePost);
});

test('Discord submission requires numeric user ID and accepts message evidence',()=>{
  const app=validateApplication({...base,channel:'discord',channelUserId:'123456789012345678',evidenceUrl:'https://discord.com/channels/1/2/3',activities:['discordVerified','discordHelpfulReply']});
  assert.equal(app.channel,'discord');
  assert.equal(scoreApplication(app),4);
  assert.equal(channelEvidenceStatus(app).review,false);
});

test('Discord nickname instead of snowflake ID is rejected',()=>{
  assert.throws(()=>validateApplication({...base,channel:'discord',channelUserId:'some-name',evidenceUrl:'https://discord.com/channels/1/2/3',activities:['discordJoin']}),/17~20자리/);
});

test('channel evidence from unexpected host is routed to review',()=>{
  const app=validateApplication({...base,channel:'naver',channelUserId:'naver-member',evidenceUrl:'https://example.com/post',activities:['naverCafePost']});
  const evidence=channelEvidenceStatus(app);
  assert.equal(evidence.review,true);
  assert.match(evidence.reason,/Naver Cafe/);
});

test('legacy application defaults to other channel',()=>{
  const app=validateApplication({...base,evidenceUrl:'https://example.com/a',activities:['join']});
  assert.equal(app.channel,'other');
  assert.equal(app.channelUserId,null);
});
