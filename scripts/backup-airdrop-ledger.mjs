import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const source=resolve(process.env.AIRDROP_LEDGER_PATH||'dashboard/.airdrop-data/events.jsonl');
const destDir=resolve(process.env.AIRDROP_BACKUP_DIR||'backups/airdrop');
const data=await readFile(source);
if(data.length && data.at(-1)!==10) throw Error('Ledger must end with newline before backup');
const sha256=createHash('sha256').update(data).digest('hex');
await mkdir(destDir,{recursive:true,mode:0o700});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=join(destDir,'events-'+stamp+'.jsonl');
await copyFile(source,out);
await writeFile(out+'.sha256',sha256+'  '+out.split('/').at(-1)+'\n',{mode:0o600});
console.log(JSON.stringify({backup:out,sha256,bytes:data.length},null,2));
