import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ShahCat from './shared.js';
import {isOnCurve,decode58,encode58,deriveAssociatedTokenAddress,compileLegacyMessage,
  unsignedWireTransaction,quoteUnsignedTransfer,TOKEN_PROGRAM} from './transfer-quote.mjs';
const v=JSON.parse(readFileSync(new URL('./fixtures/solana-sdk-reference.json',import.meta.url),'utf8'));

test('official SDK curve, base58 and ATA reference vectors',()=>{
  assert.equal(v.mint,ShahCat.MINT);
  for(const item of v.curves){
    const bytes=Buffer.from(item.hex,'hex');
    assert.equal(isOnCurve(bytes),item.onCurve,item.address);
    assert.equal(encode58(bytes),item.address);
    assert.deepEqual(decode58(item.address),bytes);
    if(!item.onCurve) assert.throws(()=>deriveAssociatedTokenAddress(item.address),/on-curve/);
  }
  for(const item of v.atas) assert.equal(deriveAssociatedTokenAddress(item.owner),item.ata);
});
for(const item of v.cases){
  test(`official SDK message and wire: ATA exists=${item.exists}, raw=${item.raw}`,()=>{
    const instructions=item.instructions.map(ix=>({...ix,data:Buffer.from(ix.dataHex,'hex')}));
    const actual=compileLegacyMessage(v.sender,v.blockhash,instructions);
    assert.equal(actual.toString('base64'),item.messageBase64);
    assert.equal(unsignedWireTransaction(actual).toString('base64'),item.wireBase64);
  });
  test(`quote RPC payload matches SDK: ATA exists=${item.exists}, raw=${item.raw}`,async()=>{
    const token=owner=>({owner:TOKEN_PROGRAM,data:{parsed:{type:'account',info:{owner,mint:v.mint,state:'initialized',
      tokenAmount:{amount:'18446744073709551615',decimals:9}}}}});
    const calls=[];
    const query=async(method,params)=>{
      calls.push(method);
      switch(method){
        case 'getGenesisHash':return ShahCat.DEVNET_GENESIS;
        case 'getBalance':return {value:50000000};
        case 'getTokenAccountsByOwner':return {value:[{pubkey:v.source,account:token(v.sender)}]};
        case 'getAccountInfo':
          if(params[0]===v.mint)return {value:{owner:TOKEN_PROGRAM,data:{parsed:{type:'mint',info:{decimals:9,isInitialized:true}}}}};
          if(params[0]===v.source)return {value:token(v.sender)};
          assert.equal(params[0],v.ata);return {value:item.exists?token(v.recipient):null};
        case 'getLatestBlockhash':return {value:{blockhash:v.blockhash,lastValidBlockHeight:1000}};
        case 'getFeeForMessage':assert.equal(params[0],item.messageBase64);return {value:5000};
        case 'getMinimumBalanceForRentExemption':assert.equal(params[0],165);return 2039280;
        case 'simulateTransaction':
          assert.equal(params[0],item.wireBase64);
          assert.equal(params[1].sigVerify,false);
          return {value:{err:null}};
        default:assert.fail('Unexpected RPC: '+method);
      }
    };
    const raw=BigInt(item.raw);
    const quantity=`${raw/1000000000n}.${String(raw%1000000000n).padStart(9,'0')}`;
    const result=await quoteUnsignedTransfer({sender:v.sender,recipient:v.recipient,quantity},query);
    assert.equal(result.recipientAta,v.ata);
    assert.equal(result.signatureEnabled,false);
    assert.equal(result.broadcastingEnabled,false);
    assert.equal(calls.filter(m=>m==='simulateTransaction').length,1);
    assert.equal(calls.includes('getMinimumBalanceForRentExemption'),!item.exists);
  });
}
