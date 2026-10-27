// Offline crosscheck of the original legacy-tool inputs against the maintained SDK.
// Public fixed addresses only; no RPC, keys, wallet access, signing or broadcasting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  address, AccountRole, getAddressEncoder, getAddressDecoder, isOffCurveAddress,
  createTransactionMessage, setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
  compileTransaction, getTransactionEncoder,
} from '@solana/kit';
import {
  findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS,
  getTransferCheckedInstruction, getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import ShahCat from '../../dashboard/shared.js';
import {
  deriveAssociatedTokenAddress, decode58, encode58, isOnCurve,
  compileLegacyMessage, unsignedWireTransaction, ATA_PROGRAM, TOKEN_PROGRAM, SYSTEM_PROGRAM,
} from '../../dashboard/transfer-quote.mjs';

const treasury = '9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9';
const development = '3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs';
const missingAtaRecipient = '3UaYYNWCNNwsvXvRMgtkwePnHMNreZLSST5618pjMTm9';
const zeroBlockhash = '11111111111111111111111111111111';
const fixture = JSON.parse(readFileSync(new URL('../../dashboard/fixtures/solana-sdk-reference.json', import.meta.url), 'utf8'));
const encoder = getAddressEncoder();
const decoder = getAddressDecoder();
const ownInstruction = (programId, keys, data) => ({
  programId, keys: keys.map(([pubkey, writable = false, signer = false]) => ({ pubkey, writable, signer })),
  data: Buffer.from(data),
});

test('original eight public addresses retain base58, curve and wallet ATA parity', async () => {
  for (const value of [treasury, development, missingAtaRecipient, ShahCat.MINT,
    TOKEN_PROGRAM, ATA_PROGRAM, SYSTEM_PROGRAM, zeroBlockhash]) {
    const bytes = Buffer.from(encoder.encode(address(value)));
    assert.deepEqual(decode58(value), bytes, value);
    assert.equal(encode58(bytes), value);
    assert.equal(decoder.decode(bytes), value);
    assert.equal(isOnCurve(bytes), !isOffCurveAddress(address(value)), value);
  }
  for (const owner of [treasury, development, missingAtaRecipient]) {
    assert.equal(isOffCurveAddress(address(owner)), false);
    const [ata] = await findAssociatedTokenPda({ owner: address(owner), mint: address(ShahCat.MINT), tokenProgram: TOKEN_PROGRAM_ADDRESS });
    assert.equal(deriveAssociatedTokenAddress(owner), ata);
    assert.equal(isOffCurveAddress(ata), true);
  }
});

test('69 historical base58 vectors preserve runtime results; curve drift is exactly inventoried', () => {
  assert.equal(fixture.curves.length, 69);
  const differences = [];
  for (const item of fixture.curves) {
    const bytes = Buffer.from(item.hex, 'hex');
    assert.equal(decoder.decode(bytes), item.address);
    assert.deepEqual(Buffer.from(encoder.encode(address(item.address))), bytes);
    const modernOnCurve = !isOffCurveAddress(address(item.address));
    if (modernOnCurve !== item.onCurve) differences.push({ hex: item.hex, historical: item.onCurve, modern: modernOnCurve });
    assert.equal(isOnCurve(bytes), item.onCurve, item.address);
    if (!item.onCurve) assert.throws(() => deriveAssociatedTokenAddress(item.address), /on-curve/);
  }
  // Explicit compatibility finding, not a waiver or a change to the frozen oracle.
  // Kit reduces a noncanonical y modulo p; our legacy-compatible runtime rejects it.
  // Any additional difference, or an upstream behavior change, requires review.
  assert.deepEqual(differences, [{ hex: 'ff'.repeat(32), historical: false, modern: true }]);
});

test('noncanonical all-ff curve encoding remains rejected by the production ATA path', () => {
  const bytes = Buffer.alloc(32, 255);
  const value = decoder.decode(bytes);
  assert.equal(value, 'JEKNVnkbo3jma5nREBBJCDoXFVeKkD56V3xKrvRmWxFG');
  assert.equal(isOffCurveAddress(address(value)), false, 'observed Kit 6.10.0 behavior');
  assert.equal(isOnCurve(bytes), false, 'runtime retains its historical strict behavior');
  assert.throws(() => deriveAssociatedTokenAddress(value), /on-curve/);
});

for (const includeAtaCreate of [false, true]) {
  for (const rawAmount of [1n, 1000000000n, 1000000000000n]) {
    test(`original runtime message/wire parity: createATA=${includeAtaCreate}, raw=${rawAmount}`, async () => {
      const recipient = includeAtaCreate ? missingAtaRecipient : development;
      const [source] = await findAssociatedTokenPda({ owner: address(treasury), mint: address(ShahCat.MINT), tokenProgram: TOKEN_PROGRAM_ADDRESS });
      const [destination] = await findAssociatedTokenPda({ owner: address(recipient), mint: address(ShahCat.MINT), tokenProgram: TOKEN_PROGRAM_ADDRESS });
      assert.equal(deriveAssociatedTokenAddress(treasury), source);
      assert.equal(deriveAssociatedTokenAddress(recipient), destination);
      const authority = { address: address(treasury), signTransactions: async () => assert.fail('Signing is forbidden in offline crosschecks') };
      const modernInstructions = [];
      const runtimeInstructions = [];
      if (includeAtaCreate) {
        modernInstructions.push(getCreateAssociatedTokenIdempotentInstruction({
          payer: authority, ata: destination, owner: address(recipient), mint: address(ShahCat.MINT),
        }));
        runtimeInstructions.push(ownInstruction(ATA_PROGRAM, [
          [treasury, true, true], [destination, true], [recipient], [ShahCat.MINT], [SYSTEM_PROGRAM], [TOKEN_PROGRAM],
        ], [1]));
      }
      modernInstructions.push(getTransferCheckedInstruction({ source, destination, mint: address(ShahCat.MINT),
        authority, amount: rawAmount, decimals: ShahCat.DECIMALS }));
      const data = Buffer.alloc(10);
      data[0] = 12;
      data.writeBigUInt64LE(rawAmount, 1);
      data[9] = ShahCat.DECIMALS;
      runtimeInstructions.push(ownInstruction(TOKEN_PROGRAM, [
        [source, true], [ShahCat.MINT], [destination, true], [treasury, false, true],
      ], data));
      assert.equal(runtimeInstructions.length, modernInstructions.length);
      for (let i = 0; i < modernInstructions.length; i++) {
        const modern = modernInstructions[i], runtime = runtimeInstructions[i];
        assert.equal(runtime.programId, modern.programAddress);
        assert.deepEqual(runtime.keys, modern.accounts.map(account => ({
          pubkey: account.address, writable: Boolean(account.role & AccountRole.WRITABLE),
          signer: account.role >= AccountRole.READONLY_SIGNER,
        })));
        assert.deepEqual(runtime.data, Buffer.from(modern.data));
      }
      const modernMessage = appendTransactionMessageInstructions(modernInstructions,
        setTransactionMessageLifetimeUsingBlockhash({ blockhash: zeroBlockhash, lastValidBlockHeight: 0n },
          setTransactionMessageFeePayer(address(treasury), createTransactionMessage({ version: 'legacy' }))));
      const compiled = compileTransaction(modernMessage);
      const runtimeMessage = compileLegacyMessage(treasury, zeroBlockhash, runtimeInstructions);
      assert.deepEqual(runtimeMessage, Buffer.from(compiled.messageBytes));
      const runtimeWire = unsignedWireTransaction(runtimeMessage);
      assert.deepEqual(runtimeWire, Buffer.from(getTransactionEncoder().encode(compiled)));
      assert.equal(runtimeWire[0], 1);
      assert.deepEqual(runtimeWire.subarray(1, 65), Buffer.alloc(64));
    });
  }
}

test('original simulation recipient remains on-curve and distinct from project wallets', () => {
  assert.equal(isOffCurveAddress(address(missingAtaRecipient)), false);
  assert.notEqual(missingAtaRecipient, treasury);
  assert.notEqual(missingAtaRecipient, development);
});
