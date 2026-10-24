import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TreasuryStore, IDS, validateConfig } from './treasury-store.mjs';
import Policy from './tokenomics.js';
function base58(bytes) {
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n=BigInt('0x'+bytes.toString('hex')), out='';
  while(n){out=alphabet[Number(n%58n)]+out;n/=58n;} for(const b of bytes){if(b)break;out='1'+out;} return out;
}
export function key() { const pair=generateKeyPairSync('ed25519'); return {...pair,address:base58(pair.publicKey.export({type:'spki',format:'der'}).subarray(-32))}; }
export async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'shah-treasury-')), pairs=Object.fromEntries(IDS.map(id=>[id,key()]));
  const config={network:'devnet',mint:Policy.MINT,treasury:key().address,signers:Object.fromEntries(IDS.map(id=>[id,pairs[id].address]))};
  const path=join(dir,'events.jsonl');let time=Date.parse('2026-10-15T00:00:00Z');
  const store=await TreasuryStore.open({config,path,clock:()=>time});
  t.after(async()=>{await store.close();await rm(dir,{recursive:true,force:true});});
  const vote=(p,signer,decision='approve',message=store.message(p.id,p.revision,signer,decision))=>store.decide({id:p.id,revision:p.revision,signer,decision,signature:sign(null,Buffer.from(message),pairs[signer].privateKey).toString('base64')});
  return {store,config,pairs,path,vote,setTime:x=>{time=Date.parse(x);}};
}
export const content=(kind='budget',extra={})=>({kind,purpose:'개발 인프라',evidence:'견적 #1',amountRaw:'1000000000000',feeCapLamports:'10000000',startsAt:'2026-10-01T00:00:00.000Z',expiresAt:'2026-11-01T00:00:00.000Z',recipient:kind==='budget'?null:key().address,conflicts:[],budgetId:null,...extra});
async function budget(w,extra={}) {const p=await w.store.create(content('budget',extra));for(const id of IDS)await w.vote(p,id);return p;}

