// Independent reference generator: no imports from dashboard implementation.
// Public deterministic inputs only. No Connection, Keypair, signing or sending.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const pk = value => new PublicKey(value);
const sender = pk('3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs');
const recipient = pk('9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9');
const mint = pk('82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2');
const source = pk('So11111111111111111111111111111111111111112');
const blockhash = pk(createHash('sha256').update('SHAH offline blockhash').digest()).toBase58();
const ata = getAssociatedTokenAddressSync(mint, recipient);
const curves = [sender.toBuffer(), recipient.toBuffer(), ata.toBuffer(),
  Buffer.alloc(32), Buffer.alloc(32, 255),
  ...Array.from({length:64}, (_,i) => createHash('sha256').update(`SHAH curve ${i}`).digest())]
  .map(bytes => ({hex:bytes.toString('hex'), address:pk(bytes).toBase58(), onCurve:PublicKey.isOnCurve(bytes)}));
const atas = curves.filter(v=>v.onCurve).map(v=>({owner:v.address,
  ata:getAssociatedTokenAddressSync(mint,pk(v.address)).toBase58()}));
const cases = [];
for (const exists of [true,false]) for (const raw of [1n,1000000000n,18446744073709551615n]) {
  const instructions = [];
  if (!exists) instructions.push(createAssociatedTokenAccountIdempotentInstruction(sender,ata,recipient,mint));
  instructions.push(createTransferCheckedInstruction(source,mint,ata,sender,raw,9));
  const transaction = new Transaction({feePayer:sender,recentBlockhash:blockhash}).add(...instructions);
  const message = transaction.compileMessage();
  const wire=transaction.serialize({requireAllSignatures:false,verifySignatures:false});
  cases.push({exists,raw:String(raw),messageBase64:message.serialize().toString('base64'),wireBase64:wire.toString('base64'),
    instructions:instructions.map(ix=>({programId:ix.programId.toBase58(),
      keys:ix.keys.map(k=>({pubkey:k.pubkey.toBase58(),signer:k.isSigner,writable:k.isWritable})),dataHex:ix.data.toString('hex')}))});
}
const result=JSON.stringify({sdk:{web3:'1.98.4',splToken:'0.4.15'},sender:sender.toBase58(),recipient:recipient.toBase58(),
  mint:mint.toBase58(),source:source.toBase58(),ata:ata.toBase58(),blockhash,curves,atas,cases},null,2)+'\n';
const target=new URL('../../dashboard/fixtures/solana-sdk-reference.json',import.meta.url);
if(process.argv.includes('--check')) assert.equal(readFileSync(target,'utf8').replaceAll('\r\n','\n'),result,'SDK fixture drift');
else writeFileSync(target,result);
console.log(`SDK reference verified: ${curves.length} curve, ${atas.length} ATA, ${cases.length} transaction vectors`);
