import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const source=resolve(process.env.AIRDROP_LEDGER_PATH||'dashboard/.airdrop-data/events.jsonl');
const destDir=resolve(process.env.AIRDROP_BACKUP_DIR||'backups/airdrop');
const data=await readFile(source);
if(data.length && data.at(-1)!==10) throw Error('Ledger must end with newline before backup');
const sha256=createHash('sha256').update(data).digest('hex');
await mkdir(destDir,{recursive:true,mode:0o700});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=join(destDir,'events-'+stamp+'.jsonl');
// Write the exact bytes hashed above, even if the live ledger grows meanwhile.
await writeFile(out,data,{mode:0o600,flag:'wx'});
await writeFile(out+'.sha256',sha256+'  '+basename(out)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({backup:out,sha256,bytes:data.length},null,2));
