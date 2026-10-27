import test from 'node:test';
import assert from 'node:assert/strict';
import { discordApplication, naverCafeApplication } from './airdrop-community-adapters.mjs';

const common={communityId:'member',wallet:'3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs',submittedAt:'2026-10-29T00:00:00.000Z'};

test('Discord adapter uses immutable numeric user id',()=>{
  const x=discordApplication({...common,discordUserId:'123456789012345678',evidenceUrl:'https://discord.com/channels/1/2/3',activities:['discordVerified']});
  assert.equal(x.channel,'discord');
  assert.equal(x.channelUserId,'123456789012345678');
});

test('Discord adapter rejects nickname-shaped identity',()=>{
  assert.throws(()=>discordApplication({...common,discordUserId:'nickname',activities:['discordJoin']}),/형식/);
});

test('Naver Cafe adapter maps evidence and account identity',()=>{
  const x=naverCafeApplication({...common,naverId:'naver-member',evidenceUrl:'https://cafe.naver.com/example/123',activities:['naverCafePost']});
  assert.equal(x.channel,'naver');
  assert.equal(x.channelUserId,'naver-member');
});
