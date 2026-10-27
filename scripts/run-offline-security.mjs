// Explicit scope excludes server/socket smoke tests and all Treasury endpoints.
import './offline-security-guard.cjs';
for (const file of [
  '../dashboard/shared.test.mjs', '../dashboard/project-config.test.mjs',
  '../dashboard/sdk-reference.test.mjs', '../dashboard/transfer-preflight.test.mjs',
  '../dashboard/transfer-quote.test.mjs', '../dashboard/devnet-security.test.mjs',
  '../dashboard/wallet-connectors.test.mjs', '../dashboard/dashboard.test.mjs',
  '../dashboard/preflight-ui.test.mjs', '../dashboard/quote-ui.test.mjs',
  '../research/four-way/devnet-readonly.test.mjs',
  '../research/four-way/devnet-readonly-adversarial.test.mjs',
  '../research/four-way/devnet-receipt.test.mjs',
  '../research/four-way/devnet-receipt-adversarial.test.mjs',
  './offline-security-guard.test.mjs',
]) await import(file);
