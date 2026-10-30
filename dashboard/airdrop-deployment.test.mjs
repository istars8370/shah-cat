import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { renderNginx } from '../scripts/render-airdrop-nginx.mjs';
import { airdropPublicAPI } from './airdrop-public-api.mjs';

test('real backup writes exactly checksummed bytes with private permissions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-backup-write-'));
  try{
    const path=join(dir,'events.jsonl');await writeFile(path,'');
    const r=spawnSync(process.execPath,['scripts/backup-airdrop-ledger.mjs'],{encoding:'utf8',
      env:{...process.env,AIRDROP_LEDGER_PATH:path,AIRDROP_BACKUP_DIR:join(dir,'backups')}});
    assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);
    const data=await readFile(out.backup);
    assert.equal(createHash('sha256').update(data).digest('hex'),out.sha256);
    assert.equal((await readFile(out.backup+'.sha256','utf8')).split(/\s/)[0],out.sha256);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('staging renderer rejects configuration injection and insecure Origin',async()=>{
  const c={origin:'https://staging.example.com',cert:resolve('certificate.pem'),key:resolve('key.pem')};
  const out=await renderNginx(c);
  assert.ok(!out.includes('__HOST__'));assert.ok(out.includes('default $http_origin'));
  for(const patch of [{origin:'http://staging.example.com'},{origin:'https://staging.example.com/path'},
    {key:resolve('key.pem')+'"; root /; #'},{listen:'0.0.0.0:99999'}])await assert.rejects(renderNginx({...c,...patch}));
});

test('health stays minimal and unavailable when ledger initialization fails',async()=>{
  const prior={...process.env};
  process.env.AIRDROP_STARTS_AT='2026-10-29T00:00:00.000Z';
  process.env.AIRDROP_PUBLIC_ORIGIN='https://staging.example.com';
  process.env.AIRDROP_ADMIN_TOKEN='isolated-runtime-test-token-123456';
  const server=http.createServer((req,res)=>airdropPublicAPI(req,res,async()=>{throw Error('private-ledger-path');}));
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  try{
    const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/airdrop/public/health',{
      headers:{origin:'https://staging.example.com'}});
    assert.equal(r.status,503);assert.deepEqual(await r.json(),{ready:false,version:'0.1'});
  }finally{
    await new Promise(ok=>server.close(ok));
    for(const key of ['AIRDROP_STARTS_AT','AIRDROP_PUBLIC_ORIGIN','AIRDROP_ADMIN_TOKEN']){
      if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];
    }
  }
});

test('load probe fails invalid count/concurrency rather than silently submitting zero',()=>{
  for(const patch of [{AIRDROP_LOAD_COUNT:'NaN'},{AIRDROP_LOAD_COUNT:'151'},{AIRDROP_LOAD_CONCURRENCY:'0'}]){
    const r=spawnSync(process.execPath,['scripts/airdrop-load-staging.mjs'],{encoding:'utf8',env:{...process.env,
      AIRDROP_LOAD_CONFIRM:'STAGING_ONLY',AIRDROP_LOAD_TARGET:'https://staging.example.com',
      AIRDROP_LOAD_ORIGIN:'https://staging.example.com',...patch}});
    assert.notEqual(r.status,0);assert.match(r.stderr,/must be an integer/);
  }
});
