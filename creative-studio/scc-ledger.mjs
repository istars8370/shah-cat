// SHAH CAT Studio SCC v0.1: isolated, in-memory simulation only.
// No paid issuance, chain integration, cash redemption, or API routes.

const MAX_CREDITS = 1_000_000;
const MAX_ACCOUNTS = 100;
const MAX_EVENTS_PER_ACCOUNT = 500;
const MAX_RESERVATION_TTL_MS = 3_600_000;
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
      item = { lots: [], refunds: new Map(), reservations: new Map(), usedIds: new Set(), events: [] };
      accounts.set(id, item);
    }
    return item;
  };
  const balances = (item, at) => {
    const b = { bonus_available: 0, bonus_expired: 0, paid_demo_available: 0,
      paid_refund_reserved: 0, bonus_service_reserved: 0, paid_demo_service_reserved: 0,
      total_service_reserved: 0, total_available: 0, currency: 'SCC', sandbox: true };
    if (!item) return b;
    for (const lot of item.lots) {
      if (lot.source === 'BONUS') {
        if (lot.expiresAt !== null && Date.parse(lot.expiresAt) <= at) b.bonus_expired += lot.available;
        else b.bonus_available += lot.available;
        b.bonus_service_reserved += lot.serviceReserved;
      } else {
        b.paid_demo_available += lot.available;
        b.paid_demo_service_reserved += lot.serviceReserved;
        b.paid_refund_reserved += lot.reserved;
      }
    }
    b.total_available = b.bonus_available + b.paid_demo_available;
    b.total_service_reserved = b.bonus_service_reserved + b.paid_demo_service_reserved;
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
      const lot = { lotId: grantId, source, available: credits, reserved: 0, serviceReserved: 0, expiresAt,
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

  // Reservations are synchronous and scoped to one in-memory sandbox instance.
  // No provider response, authenticated caller, database lock or payment is present.
  function reserve(input) {
    return runOnce(input, 'reserve', (id, at) => {
      const { reservationId, credits, expiresAt } = input;
      checkId(reservationId, 'reservationId'); checkCredits(credits);
      const deadline = isoTime(expiresAt);
      if (deadline <= at || deadline - at > MAX_RESERVATION_TTL_MS) {
        fail('INVALID_INPUT', 'Reservation deadline must be within one hour');
      }
      const item = account(id);
      if (!item) fail('INSUFFICIENT', 'Account has no spendable SCC');
      ensureCapacity(item); ensureNewId(item, reservationId);
      // Never reserve a BONUS lot that expires before the hold completes.
      const candidates = item.lots.filter(lot => lot.source === 'BONUS' && lot.available > 0 &&
        (lot.expiresAt === null || Date.parse(lot.expiresAt) > deadline))
        .sort((a, b) => (a.expiresAt ? Date.parse(a.expiresAt) : Infinity) -
          (b.expiresAt ? Date.parse(b.expiresAt) : Infinity));
      candidates.push(...item.lots.filter(lot => lot.source === 'PAID_DEMO' && lot.available > 0));
      let rest = credits;
      const plan = [];
      for (const lot of candidates) {
        const amount = Math.min(lot.available, rest);
        if (amount) plan.push({ lot, amount });
        rest -= amount;
        if (rest === 0) break;
      }
      if (rest !== 0) fail('INSUFFICIENT', 'Not enough eligible SCC to reserve');
      const allocations = plan.map(({ lot, amount }) => ({
        grantId: lot.lotId, source: lot.source, credits: amount }));
      for (const { lot, amount } of plan) {
        lot.available -= amount;
        lot.serviceReserved += amount;
      }
      const reservation = { reservationId, credits, expiresAt, status: 'ACTIVE', allocations };
      item.reservations.set(reservationId, reservation);
      item.usedIds.add(reservationId);
      const event = append(item, { type: 'RESERVE', accountId: id, reservationId,
        credits, at: new Date(at).toISOString(), expiresAt, allocations });
      return { event, balance: balances(item, at), reservation: copy(reservation) };
    });
  }

  function settleReservation(input) {
    return runOnce(input, 'settleReservation', (id, at) => {
      const { reservationId, credits } = input;
      checkId(reservationId, 'reservationId'); checkCredits(credits);
      const item = account(id);
      const reservation = item?.reservations.get(reservationId);
      if (!reservation) fail('NOT_FOUND', 'Unknown reservation for account');
      if (reservation.status !== 'ACTIVE') fail('CONFLICT', 'Reservation is not active');
      if (Date.parse(reservation.expiresAt) <= at) fail('EXPIRED', 'Reservation has expired');
      if (credits > reservation.credits) fail('BUDGET', 'Settlement exceeds reserved amount');
      ensureCapacity(item);
      let remain = credits;
      const spent = [];
      const released = [];
      const plan = [];
      for (const line of reservation.allocations) {
        const lot = item.lots.find(candidate => candidate.lotId === line.grantId);
        if (!lot || lot.serviceReserved < line.credits || lot.source !== line.source) {
          fail('INVALID_STATE', 'Reserved lot does not reconcile');
        }
        const used = Math.min(remain, line.credits);
        remain -= used;
        plan.push({ lot, reserved: line.credits, used });
        if (used) spent.push({ grantId: line.grantId, source: line.source, credits: used });
        if (line.credits - used) released.push({ grantId: line.grantId,
          source: line.source, credits: line.credits - used });
      }
      if (remain !== 0) fail('INVALID_STATE', 'Reservation amount mismatch');
      for (const { lot, reserved, used } of plan) {
        lot.serviceReserved -= reserved;
        lot.available += reserved - used;
      }
      reservation.status = 'SETTLED';
      reservation.settledCredits = credits;
      const event = append(item, { type: 'RESERVATION_SETTLED', accountId: id,
        reservationId, at: new Date(at).toISOString(), credits,
        releasedCredits: reservation.credits - credits, allocations: spent, released });
      return { event, balance: balances(item, at) };
    });
  }

  function releaseReservation(input) {
    return runOnce(input, 'releaseReservation', (id, at) => {
      const { reservationId } = input;
      checkId(reservationId, 'reservationId');
      const item = account(id);
      const reservation = item?.reservations.get(reservationId);
      if (!reservation) fail('NOT_FOUND', 'Unknown reservation for account');
      if (reservation.status !== 'ACTIVE') fail('CONFLICT', 'Reservation is not active');
      ensureCapacity(item);
      const plan = reservation.allocations.map(line => {
        const lot = item.lots.find(candidate => candidate.lotId === line.grantId);
        if (!lot || lot.source !== line.source || lot.serviceReserved < line.credits) {
          fail('INVALID_STATE', 'Reserved lot does not reconcile');
        }
        return { lot, credits: line.credits };
      });
      for (const { lot, credits } of plan) {
        lot.serviceReserved -= credits;
        lot.available += credits;
      }
      reservation.status = at >= Date.parse(reservation.expiresAt) ? 'EXPIRED' : 'RELEASED';
      const event = append(item, { type: 'RESERVATION_RELEASED', accountId: id,
        reservationId, at: new Date(at).toISOString(), status: reservation.status,
        credits: reservation.credits, allocations: copy(reservation.allocations) });
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
        credits: refund.credits, status: refund.status })) : [],
      service_reservations: item ? [...item.reservations.values()].map(reservation => ({
        reservationId: reservation.reservationId, credits: reservation.credits,
        expiresAt: reservation.expiresAt, status: reservation.status })) : [] });
  }
  function events(accountId) {
    return copy(account(accountId)?.events || []);
  }
  return Object.freeze({ grant, consume, reserve, settleReservation, releaseReservation,
    requestRefund, cancelRefund, snapshot, events });
}
