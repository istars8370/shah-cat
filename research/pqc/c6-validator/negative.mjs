import {Connection,Keypair,PublicKey,Transaction,TransactionInstruction,SystemProgram} from '@solana/web3.js';
import {readFileSync} from 'node:fs';
const endpoint = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const programId = new PublicKey(process.env.C6_PROGRAM_ID);
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.C6_PAYER_KEYPAIR,'utf8'))));
const connection = new Connection(endpoint,'confirmed');
const tests = [
  {name:'invalid discriminator', data:Buffer.from([0,0,0])},
  {name:'C5 missing public-key account', data:Buffer.from([0x53,0x43,0x01,0x02,1,0,1,0,0,0])},
  {name:'C3 malformed lengths', data:Buffer.from([0x53,0x43,0x01,0x01,0xff,0xff,0xff,0xff,0xff,0xff])}
];
for(const test of tests) {
  const instruction = new TransactionInstruction({programId,keys:[],data:test.data});
  const tx = new Transaction().add(instruction);
  tx.feePayer=payer.publicKey;
  tx.recentBlockhash=(await connection.getLatestBlockhash()).blockhash;
  tx.sign(payer);
  const bytes=tx.serialize();
  if(bytes.length>1232) throw Error('oversized tx');
  const sim=await connection.simulateTransaction(tx,{sigVerify:true,replaceRecentBlockhash:false});
  console.log(JSON.stringify({case:test.name,txBytes:bytes.length,unitsConsumed:sim.value.unitsConsumed,err:sim.value.err,logs:sim.value.logs},null,2));
  if(sim.value.err===null) throw Error('Unexpected acceptance: '+test.name);
  if(!sim.value.logs?.some(x=>x.includes('Program '+programId.toBase58()+' invoke'))) throw Error('Program was not invoked: '+test.name);
}
console.log('C6 PASS: deployed SBF program rejected all malformed requests on local validator; valid Falcon verification NOT tested');
