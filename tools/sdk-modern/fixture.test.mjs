import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { address, AccountRole, createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, compileTransaction, getTransactionEncoder } from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS, getTransferCheckedInstruction, getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';
const f = JSON.parse(readFileSync(new URL('../../dashboard/fixtures/solana-sdk-reference.json', import.meta.url), 'utf8'));
test('all frozen owner ATA derivations', async () => {
  assert.equal(f.atas.length, 38);
  for (const item of f.atas) {
    const [derived] = await findAssociatedTokenPda({ mint: address(f.mint), owner: address(item.owner), tokenProgram: TOKEN_PROGRAM_ADDRESS });
    assert.equal(derived, item.ata);
  }
});
test('six fixed legacy messages and unsigned wire transactions', () => {
  assert.equal(f.cases.length, 6);
  const authority = { address: address(f.sender), signTransactions: async () => { throw new Error('Offline verification must never sign'); } };
  for (const c of f.cases) {
    const ix = [];
    if (!c.exists) ix.push(getCreateAssociatedTokenIdempotentInstruction({ payer: authority, ata: address(f.ata), owner: address(f.recipient), mint: address(f.mint) }));
    ix.push(getTransferCheckedInstruction({ source: address(f.source), mint: address(f.mint), destination: address(f.ata), authority, amount: BigInt(c.raw), decimals: 9 }));
    assert.equal(ix.length, c.instructions.length);
    for (let i = 0; i < ix.length; i++) {
      const actual = ix[i], expected = c.instructions[i];
      assert.equal(actual.programAddress, expected.programId);
      assert.deepEqual(actual.accounts.map(a => a.address), expected.keys.map(a => a.pubkey));
      assert.deepEqual(actual.accounts.map(a => Boolean(a.role & AccountRole.WRITABLE)), expected.keys.map(a => a.writable));
      assert.deepEqual(actual.accounts.map(a => a.role >= AccountRole.READONLY_SIGNER), expected.keys.map(a => a.signer));
      assert.equal(Buffer.from(actual.data).toString('hex'), expected.dataHex);
    }
    const message = appendTransactionMessageInstructions(ix, setTransactionMessageLifetimeUsingBlockhash({ blockhash: f.blockhash, lastValidBlockHeight: 0n }, setTransactionMessageFeePayer(address(f.sender), createTransactionMessage({ version: 'legacy' }))));
    const compiled = compileTransaction(message);
    assert.equal(Buffer.from(compiled.messageBytes).toString('base64'), c.messageBase64);
    assert.equal(Buffer.from(getTransactionEncoder().encode(compiled)).toString('base64'), c.wireBase64);
  }
});

test('negative controls reject changed amount, destination, and instruction program', () => {
  const sample = f.cases.find(c => c.exists);
  assert.ok(sample);
  const authority = { address: address(f.sender), signTransactions: async () => { throw new Error('No signing'); } };
  const build = (destination, amount) => {
    const instruction = getTransferCheckedInstruction({ source: address(f.source), mint: address(f.mint), destination: address(destination), authority, amount, decimals: 9 });
    const message = appendTransactionMessageInstructions([instruction], setTransactionMessageLifetimeUsingBlockhash({ blockhash: f.blockhash, lastValidBlockHeight: 0n }, setTransactionMessageFeePayer(address(f.sender), createTransactionMessage({ version: 'legacy' }))));
    return { instruction, bytes: Buffer.from(compileTransaction(message).messageBytes).toString('base64') };
  };
  const correct = build(f.ata, BigInt(sample.raw));
  assert.equal(correct.bytes, sample.messageBase64);
  assert.notEqual(build(f.source, BigInt(sample.raw)).bytes, sample.messageBase64, 'changed destination must fail parity');
  assert.notEqual(build(f.ata, BigInt(sample.raw) + 1n).bytes, sample.messageBase64, 'changed amount must fail parity');
  const changedProgram = { ...correct.instruction, programAddress: address(f.sender) };
  const changedMessage = appendTransactionMessageInstructions([changedProgram], setTransactionMessageLifetimeUsingBlockhash({ blockhash: f.blockhash, lastValidBlockHeight: 0n }, setTransactionMessageFeePayer(address(f.sender), createTransactionMessage({ version: 'legacy' }))));
  assert.notEqual(Buffer.from(compileTransaction(changedMessage).messageBytes).toString('base64'), sample.messageBase64, 'changed program must fail parity');
});
