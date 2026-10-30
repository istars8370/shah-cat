import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

function event(seq,prev,type){
  const body={seq,prev,at:'2026-10-29T00:00:00.000Z',type,application:null};
  return {...body,digest:createHash('sha256').update(JSON.stringify(body)).digest('hex')};
}
test('backup verifier accepts intact hash chain and rejects checksum changes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'shah-backup-'));
  try{
    const e0=event(0,null,'init');
    const e1=event(1,e0.digest,'checkpoint');
    const file=join(dir,'events.jsonl');
    const data=JSON.stringify(e0)+'\n'+JSON.stringify(e1)+'\n';
    await writeFile(file,data);
    const sum=createHash('sha256').update(data).digest('hex');
    const checksum=file+'.sha256';
    await writeFile(checksum,sum+'  events.jsonl\n');
    const ok=spawnSync(process.execPath,['scripts/verify-airdrop-backup.mjs',file,checksum],{encoding:'utf8'});
    assert.equal(ok.status,0,ok.stderr);
    await writeFile(file,data+'x');
    const bad=spawnSync(process.execPath,['scripts/verify-airdrop-backup.mjs',file,checksum],{encoding:'utf8'});
    assert.notEqual(bad.status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
