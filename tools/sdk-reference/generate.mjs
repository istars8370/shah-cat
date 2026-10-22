// Independent reference generator: no imports from dashboard implementation.
// Public deterministic inputs only. No Connection, Keypair, signing or sending.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PublicKey, Message, Transaction, TransactionMessage } from '@solana/web3.js';
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
  const sdk = new TransactionMessage({payerKey:sender,recentBlockhash:blockhash,instructions}).compileToLegacyMessage();
  // Legacy account order is not unique. Fix a documented valid order, then use
  // SDK Message serialization; SDK instruction builders supply all data/roles.
  const order = exists ? [sender,source,ata,mint,TOKEN_PROGRAM_ID] :
    [sender,ata,source,recipient,mint,pk('11111111111111111111111111111111'),TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID];
  const indexes = new Map(order.map((key,i)=>[key.toBase58(),i]));
  const message = new Message({header:sdk.header,accountKeys:order,recentBlockhash:blockhash,
    instructions:sdk.instructions.map(ix=>({programIdIndex:indexes.get(sdk.accountKeys[ix.programIdIndex].toBase58()),
      accounts:ix.accounts.map(i=>indexes.get(sdk.accountKeys[i].toBase58())),data:ix.data}))});
  for(let i=0;i<order.length;i++) {
    const old=sdk.accountKeys.findIndex(k=>k.equals(order[i]));
    assert.equal(message.isAccountSigner(i),sdk.isAccountSigner(old));
    assert.equal(message.isAccountWritable(i),sdk.isAccountWritable(old));
  }
  const transaction=Transaction.populate(message);
  const wire=transaction.serialize({requireAllSignatures:false,verifySignatures:false});
  cases.push({exists,raw:String(raw),messageBase64:message.serialize().toString('base64'),wireBase64:wire.toString('base64'),
    instructions:instructions.map(ix=>({programId:ix.programId.toBase58(),
      keys:ix.keys.map(k=>({pubkey:k.pubkey.toBase58(),signer:k.isSigner,writable:k.isWritable})),dataHex:ix.data.toString('hex')}))});
}
const result=JSON.stringify({sdk:{web3:'1.98.4',splToken:'0.4.15'},sender:sender.toBase58(),recipient:recipient.toBase58(),
  mint:mint.toBase58(),source:source.toBase58(),ata:ata.toBase58(),blockhash,curves,atas,cases},null,2)+'\n';
const target=new URL('../../dashboard/fixtures/solana-sdk-reference.json',import.meta.url);
if(process.argv.includes('--check')) assert.equal(readFileSync(target,'utf8'),result,'SDK fixture drift');
else writeFileSync(target,result);
console.log(`SDK reference verified: ${curves.length} curve, ${atas.length} ATA, ${cases.length} transaction vectors`);
