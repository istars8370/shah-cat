import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file=process.argv[2];
const checksum=process.argv[3];
if(!file||!checksum) throw Error('Usage: node scripts/verify-airdrop-backup.mjs <backup.jsonl> <backup.jsonl.sha256>');
const data=await readFile(resolve(file));
const expected=(await readFile(resolve(checksum),'utf8')).trim().split(/\s+/)[0];
const actual=createHash('sha256').update(data).digest('hex');
if(actual!==expected) throw Error('Backup checksum mismatch');
if(data.length && data.at(-1)!==10) throw Error('Backup ledger does not end with newline');
let prev=null,seq=0;
for(const line of data.toString('utf8').trim()?data.toString('utf8').trimEnd().split('\n'):[]){
  const event=JSON.parse(line);
  if(event.seq!==seq++) throw Error('Backup sequence mismatch');
  if(event.prev!==prev) throw Error('Backup chain pointer mismatch');
  const {digest,...body}=event;
  const calc=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  if(calc!==digest) throw Error('Backup digest mismatch');
  prev=digest;
}
console.log(JSON.stringify({verified:true,events:seq,sha256:actual},null,2));
