// D0 read-only Devnet evidence runner.
// No signing, keys, transaction submission, deployment or account mutation.
import { inspectDevnet } from './devnet-readonly.mjs';

const result = await inspectDevnet();
const evidence = {
  gate: 'D0',
  scope: 'read-only-devnet-network-inspection',
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  ...result,
};
console.log(JSON.stringify(evidence, null, 2));
