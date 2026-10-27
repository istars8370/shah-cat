import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { address, createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, compileTransaction, getTransactionEncoder } from '@solana/kit';
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
  const authority = { address: address(f.sender) };
  for (const c of f.cases) {
    const ix = [];
    if (!c.exists) ix.push(getCreateAssociatedTokenIdempotentInstruction({ payer: authority, ata: address(f.ata), owner: address(f.recipient), mint: address(f.mint) }));
    ix.push(getTransferCheckedInstruction({ source: address(f.source), mint: address(f.mint), destination: address(f.ata), authority, amount: BigInt(c.raw), decimals: 9 }));
    const message = appendTransactionMessageInstructions(ix, setTransactionMessageLifetimeUsingBlockhash({ blockhash: f.blockhash, lastValidBlockHeight: 0n }, setTransactionMessageFeePayer(address(f.sender), createTransactionMessage({ version: 'legacy' }))));
    const compiled = compileTransaction(message);
    assert.equal(Buffer.from(compiled.messageBytes).toString('base64'), c.messageBase64);
    assert.equal(Buffer.from(getTransactionEncoder().encode(compiled)).toString('base64'), c.wireBase64);
  }
});
