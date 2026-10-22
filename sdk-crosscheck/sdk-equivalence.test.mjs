import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import ShahCat from "../dashboard/shared.js";
import {
  deriveAssociatedTokenAddress, decode58, encode58, isOnCurve,
  compileLegacyMessage, unsignedWireTransaction,
  ATA_PROGRAM, TOKEN_PROGRAM, SYSTEM_PROGRAM,
} from "../dashboard/transfer-quote.mjs";

const { MINT, DECIMALS } = ShahCat;
const treasury = "9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9";
const development = "3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs";
const noAtaSimRecipient = "3UaYYNWCNNwsvXvRMgtkwePnHMNreZLSST5618pjMTm9";
const ZERO_BLOCKHASH = "11111111111111111111111111111111";
const addresses = [treasury, development, noAtaSimRecipient, MINT, TOKEN_PROGRAM, ATA_PROGRAM, SYSTEM_PROGRAM, ZERO_BLOCKHASH];
const pk = value => new PublicKey(value);

test("SDK v1 PublicKey decoding, curve checks and canonical ATA agree on fixed wallets", () => {
  for (const address of addresses) {
    assert.equal(encode58(decode58(address)), address);
    assert.deepEqual(decode58(address), Buffer.from(pk(address).toBytes()), address);
    assert.equal(isOnCurve(decode58(address)), PublicKey.isOnCurve(pk(address).toBytes()), address);
  }
  for (const owner of [treasury, development, noAtaSimRecipient]) {
    assert.equal(pk(owner).toBase58(), owner);
    assert.equal(PublicKey.isOnCurve(pk(owner).toBytes()), true, owner);
    const sdkAta = getAssociatedTokenAddressSync(pk(MINT), pk(owner), false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const calculated = deriveAssociatedTokenAddress(owner);
    assert.equal(calculated, sdkAta.toBase58(), owner);
    assert.equal(PublicKey.isOnCurve(sdkAta.toBytes()), false, owner);
  }
});
function ownIx(programId, keys, data) {
  return { programId, keys: keys.map(([pubkey,writable=false,signer=false])=>({pubkey,writable,signer})), data:Buffer.from(data) };
}
function sdkMeta(instruction) {
  return ownIx(instruction.programId.toBase58(),
    instruction.keys.map(x=>[x.pubkey.toBase58(),x.isWritable,x.isSigner]), instruction.data);
}
function assertSameIx(ours, sdk, title) {
  assert.equal(ours.programId,sdk.programId.toBase58(),title+" program");
  assert.deepEqual(ours.keys,sdkMeta(sdk).keys,title+" metas");
  assert.deepEqual(Buffer.from(ours.data),Buffer.from(sdk.data),title+" data");
}
function scenario(recipient, includeAtaCreate, amountRaw) {
  const sender = treasury;
  const sourceAta = getAssociatedTokenAddressSync(pk(MINT), pk(sender)).toBase58();
  const destinationAta = deriveAssociatedTokenAddress(recipient);
  const sdkInstructions = [];
  const ourInstructions = [];
  if (includeAtaCreate) {
    sdkInstructions.push(createAssociatedTokenAccountIdempotentInstruction(
      pk(sender),pk(destinationAta),pk(recipient),pk(MINT),TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID
    ));
    ourInstructions.push(ownIx(ATA_PROGRAM, [
      [sender,true,true],[destinationAta,true,false],[recipient,false,false],
      [MINT,false,false],[SYSTEM_PROGRAM,false,false],[TOKEN_PROGRAM,false,false],
    ],[1]));
  }
  const transferBytes=Buffer.alloc(10);
  transferBytes[0]=12;
  transferBytes.writeBigUInt64LE(amountRaw,1);
  transferBytes[9]=DECIMALS;
  sdkInstructions.push(createTransferCheckedInstruction(
    pk(sourceAta),pk(MINT),pk(destinationAta),pk(sender),amountRaw,DECIMALS,[],TOKEN_PROGRAM_ID
  ));
  ourInstructions.push(ownIx(TOKEN_PROGRAM,[
    [sourceAta,true,false],[MINT,false,false],[destinationAta,true,false],[sender,false,true],
  ],transferBytes));
  for(let i=0;i<sdkInstructions.length;i++)assertSameIx(ourInstructions[i],sdkInstructions[i],recipient+" ix "+i);
  const sdkTx=new Transaction({feePayer:pk(sender),recentBlockhash:ZERO_BLOCKHASH}).add(...sdkInstructions);
  const sdkMsg=Buffer.from(sdkTx.compileMessage().serialize());
  const ours=compileLegacyMessage(sender,ZERO_BLOCKHASH,ourInstructions);
  assert.deepEqual(ours,sdkMsg,"Unsigned message MUST exactly match official SDK for "+recipient+" ATA creation: "+includeAtaCreate);
  const unsigned=Buffer.from(sdkTx.serialize({requireAllSignatures:false,verifySignatures:false}));
  assert.deepEqual(unsignedWireTransaction(ours),unsigned,"Unsigned wire transaction MUST exactly match official SDK for "+recipient);
}
test("existing ATA TransferChecked instruction and unsigned message match official SDK byte-for-byte",()=>{
  for(const amount of [1n,1000000000n,1000000000000n])scenario(development,false,amount);
});
test("missing ATA CreateIdempotent + TransferChecked and unsigned message match official SDK byte-for-byte",()=>{
  for(const amount of [1n,1000000000n,1000000000000n])scenario(noAtaSimRecipient,true,amount);
});
test("simulation-only recipient is on-curve with NO private key in this repository",()=>{
  assert.equal(PublicKey.isOnCurve(pk(noAtaSimRecipient).toBytes()),true);
  assert.notEqual(noAtaSimRecipient,treasury);
  assert.notEqual(noAtaSimRecipient,development);
});
