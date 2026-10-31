// SHAH CAT Studio SCC v0.1: isolated, in-memory simulation only.
// No paid issuance, chain integration, cash redemption, or API routes.

const MAX_CREDITS = 1_000_000;
const MAX_ACCOUNTS = 100;
const MAX_EVENTS_PER_ACCOUNT = 500;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{2,79}$/;

function fail(code, reason) {
  const error = new Error(reason);
  error.code = code;
  throw error;
}
function checkId(value, label, pattern = ID) {
  if (typeof value !== 'string' || !pattern.test(value)) fail('INVALID_INPUT', 'Invalid ' + label);
  return value;
}
function checkCredits(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_CREDITS) {
    fail('INVALID_INPUT', 'Credits must be a positive bounded integer');
  }
  return value;
}
function checkObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) fail('INVALID_INPUT', 'Expected plain object');
  return value;
}
function isoTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail('INVALID_INPUT', 'Expected canonical UTC ISO timestamp');
  }
  return Date.parse(value);
}
const copy = value => structuredClone(value);

export function createSccSandbox({ now = () => Date.now() } = {}) {
  if (typeof now !== 'function') fail('INVALID_INPUT', 'Clock must be a function');
  const accounts = new Map();
  const requestKeys = new Map();

  const clock = () => {
    const t = now();
    if (!Number.isSafeInteger(t) || t < 0 || t > 8_640_000_000_000_000) {
      fail('INVALID_CLOCK', 'Invalid server clock');
    }
    return t;
  };
  const account = (id, create = false) => {
    checkId(id, 'accountId');
    let item = accounts.get(id);
    if (!item && create) {
      if (accounts.size >= MAX_ACCOUNTS) fail('LIMIT', 'Sandbox account limit reached');
      item = { lots: [], refunds: new Map(), usedIds: new Set(), events: [] };
      accounts.set(id, item);
    }
    return item;
  };
  const balances = (item, at) => {
    const b = { bonus_available: 0, bonus_expired: 0, paid_demo_available: 0,
      paid_refund_reserved: 0, total_available: 0, currency: 'SCC', sandbox: true };
    if (!item) return b;
    for (const lot of item.lots) {
      if (lot.source === 'BONUS') {
        if (lot.expiresAt !== null && Date.parse(lot.expiresAt) <= at) b.bonus_expired += lot.available;
        else b.bonus_available += lot.available;
      } else {
        b.paid_demo_available += lot.available;
        b.paid_refund_reserved += lot.reserved;
      }
    }
    b.total_available = b.bonus_available + b.paid_demo_available;
    return b;
  };
  const append = (item, event) => {
    if (item.events.length >= MAX_EVENTS_PER_ACCOUNT) fail('LIMIT', 'Sandbox event limit reached');
    const stored = copy({ ...event, sequence: item.events.length + 1 });
    item.events.push(stored);
    return stored;
  };
  const runOnce = (input, action, operation) => {
    checkObject(input);
    const id = checkId(input.accountId, 'accountId');
    const key = checkId(input.idempotencyKey, 'idempotencyKey', KEY);
    const fingerprint = JSON.stringify({ action, input });
    const prior = requestKeys.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint) fail('CONFLICT', 'Idempotency key reused with different request');
      return copy(prior.result);
    }
    const result = operation(id, clock());
    requestKeys.set(key, { fingerprint, result: copy(result) });
    return copy(result);
  };
  const ensureNewId = (item, id) => {
    if (item.usedIds.has(id)) fail('CONFLICT', 'Business reference already used');
  };
  const ensureCapacity = item => {
    if (item && item.events.length >= MAX_EVENTS_PER_ACCOUNT) fail('LIMIT', 'Sandbox event limit reached');
  };

  function grant(input) {
    return runOnce(input, 'grant', (id, at) => {
      const { source, credits, grantId, expiresAt = null } = input;
      if (!['BONUS', 'PAID_DEMO'].includes(source)) fail('INVALID_INPUT', 'Unsupported grant source');
      checkCredits(credits);
      checkId(grantId, 'grantId');
      const expiry = expiresAt === null ? null : isoTime(expiresAt);
      if (source === 'PAID_DEMO' && expiresAt !== null) fail('INVALID_INPUT', 'Paid demo credits cannot expire');
      if (expiry !== null && expiry <= at) fail('INVALID_INPUT', 'Bonus expiry must be in the future');
      const item = account(id);
      if (item) { ensureCapacity(item); ensureNewId(item, grantId); }
      const target = account(id, true);
      if (target.lots.length >= MAX_EVENTS_PER_ACCOUNT) fail('LIMIT', 'Sandbox lot limit reached');
      const lot = { lotId: grantId, source, available: credits, reserved: 0, expiresAt,
        createdAt: new Date(at).toISOString() };
      target.lots.push(lot);
      target.usedIds.add(grantId);
      const event = append(target, { type: 'GRANT', accountId: id, at: lot.createdAt,
        grantId, source, credits, expiresAt });
      return { event, balance: balances(target, at) };
    });
  }

  function consume(input) {
    return runOnce(input, 'consume', (id, at) => {
      const { credits, operationId } = input;
      checkCredits(credits); checkId(operationId, 'operationId');
      const item = account(id);
      if (!item || balances(item, at).total_available < credits) fail('INSUFFICIENT', 'Not enough available SCC');
      ensureCapacity(item); ensureNewId(item, operationId);
      const usable = item.lots.filter(lot => lot.available > 0 && lot.source === 'BONUS' &&
        (lot.expiresAt === null || Date.parse(lot.expiresAt) > at))
        .sort((a, b) => (a.expiresAt ? Date.parse(a.expiresAt) : Infinity) -
          (b.expiresAt ? Date.parse(b.expiresAt) : Infinity));
      usable.push(...item.lots.filter(lot => lot.available > 0 && lot.source === 'PAID_DEMO'));
      let rest = credits;
      const allocations = [];
      for (const lot of usable) {
        const take = Math.min(lot.available, rest);
        if (!take) continue;
        lot.available -= take; rest -= take;
        allocations.push({ grantId: lot.lotId, source: lot.source, credits: take });
        if (rest === 0) break;
      }
      if (rest !== 0) fail('INVALID_STATE', 'Credit allocation mismatch');
      item.usedIds.add(operationId);
      const event = append(item, { type: 'CONSUME', accountId: id, operationId,
        at: new Date(at).toISOString(), credits, allocations });
      return { event, balance: balances(item, at) };
    });
  }

  function requestRefund(input) {
    return runOnce(input, 'requestRefund', (id, at) => {
      const { credits, refundId } = input;
      checkCredits(credits); checkId(refundId, 'refundId');
      const item = account(id);
      if (item) ensureNewId(item, refundId);
      if (!item || balances(item, at).paid_demo_available < credits) {
        fail('INSUFFICIENT', 'Refund request exceeds unused paid-demo SCC');
      }
      ensureCapacity(item);
      let rest = credits;
      const allocations = [];
      for (const lot of item.lots.filter(lot => lot.source === 'PAID_DEMO' && lot.available > 0)) {
        const take = Math.min(lot.available, rest);
        lot.available -= take; lot.reserved += take; rest -= take;
        allocations.push({ grantId: lot.lotId, credits: take });
        if (!rest) break;
      }
      if (rest) fail('INVALID_STATE', 'Refund allocation mismatch');
      const refund = { refundId, credits, status: 'PENDING_MANUAL_REVIEW', allocations };
      item.refunds.set(refundId, refund); item.usedIds.add(refundId);
      const event = append(item, { type: 'REFUND_REQUEST', accountId: id, at: new Date(at).toISOString(),
        ...refund, cashRefunded: false });
      return { event, balance: balances(item, at) };
    });
  }

  function cancelRefund(input) {
    return runOnce(input, 'cancelRefund', (id, at) => {
      const { refundId } = input;
      checkId(refundId, 'refundId');
      const item = account(id);
      const refund = item?.refunds.get(refundId);
      if (!refund || refund.status !== 'PENDING_MANUAL_REVIEW') fail('CONFLICT', 'No pending refund request');
      ensureCapacity(item);
      for (const line of refund.allocations) {
        const lot = item.lots.find(l => l.lotId === line.grantId && l.source === 'PAID_DEMO');
        if (!lot || lot.reserved < line.credits) fail('INVALID_STATE', 'Refund reservation mismatch');
      }
      for (const line of refund.allocations) {
        const lot = item.lots.find(l => l.lotId === line.grantId);
        lot.reserved -= line.credits; lot.available += line.credits;
      }
      refund.status = 'CANCELLED';
      const event = append(item, { type: 'REFUND_CANCEL', accountId: id, refundId,
        at: new Date(at).toISOString(), credits: refund.credits, cashRefunded: false });
      return { event, balance: balances(item, at) };
    });
  }

  function snapshot(accountId) {
    const at = clock();
    const item = account(accountId);
    return copy({ accountId, ...balances(item, at), refund_requests: item ?
      [...item.refunds.values()].map(refund => ({ refundId: refund.refundId,
        credits: refund.credits, status: refund.status })) : [] });
  }
  function events(accountId) {
    return copy(account(accountId)?.events || []);
  }
  return Object.freeze({ grant, consume, requestRefund, cancelRefund, snapshot, events });
}
