import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function renderNginx({origin,cert,key,listen='0.0.0.0:443'}){
  const u=new URL(origin);
  if(u.protocol!=='https:'||u.origin!==origin||! /^[a-z0-9.-]+$/.test(u.hostname)) throw Error('Exact HTTPS staging origin required');
  if(! /^(127\.0\.0\.1|0\.0\.0\.0):\d{1,5}$/.test(listen)) throw Error('Invalid listen address');
  if(Number(listen.split(':')[1])>65535||Number(listen.split(':')[1])<1) throw Error('Invalid port');
  for(const p of [cert,key]) if(!p||!isAbsolute(p)||/["\r\n;{}$]/.test(p)) throw Error('Safe absolute certificate paths required');
  let text=await readFile(new URL('../deploy/airdrop-nginx.example.conf',import.meta.url),'utf8');
  const values={ORIGIN:origin,HOST:u.hostname,CERT:cert.replaceAll('\\','/'),KEY:key.replaceAll('\\','/'),LISTEN:listen};
  for(const [k,v] of Object.entries(values))text=text.replaceAll('__'+k+'__',v);
  return text;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const [origin,cert,key,out]=process.argv.slice(2);
  if(!out)throw Error('Usage: node scripts/render-airdrop-nginx.mjs <https-origin> <cert.pem> <key.pem> <out.conf>');
  await writeFile(out,await renderNginx({origin,cert,key}),{mode:0o600,flag:'wx'});
}
