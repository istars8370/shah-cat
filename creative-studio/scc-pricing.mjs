// SHAH CAT SCC pricing v0.2: deterministic offline estimates, never a live API tariff.
// Prices and KRW/USD rate must be supplied by the operator. All money is integer-based.
const MAX_TOKENS = 2_000_000;
const MICROS_PER_USD = 1_000_000n;
const MICROS_PER_MILLION_TOKENS = 1_000_000n;
const KRW_FX_SCALE = 1_000n;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/;

function reject(code, message) { const error = new Error(message); error.code = code; throw error; }
function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) reject('INVALID_INPUT', `Invalid ${label}`);
  return value;
}
function identifier(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) reject('INVALID_INPUT', `Invalid ${label}`);
  return value;
}
function utc(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    reject('INVALID_INPUT', `Invalid ${label}`);
  }
  return Date.parse(value);
}
function ceilDiv(a, b) { return (a + b - 1n) / b; }
function safeNumber(value) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) reject('LIMIT', 'Calculated amount exceeds safe bound');
  return Number(value);
}

export function validatePriceBook(book) {
  if (!plain(book) || book.simulation !== true || !Array.isArray(book.models) ||
      book.models.length < 1 || book.models.length > 20) reject('INVALID_PRICE_BOOK', 'Simulation price book required');
  identifier(book.version, 'price version');
  const reviewed = utc(book.reviewedAt, 'price review timestamp');
  const expires = utc(book.expiresAt, 'price expiry timestamp');
  if (expires <= reviewed) reject('INVALID_PRICE_BOOK', 'Expired or inverted price review window');
  if (typeof book.source !== 'string' || book.source.trim().length < 3 || book.source.length > 300) {
    reject('INVALID_PRICE_BOOK', 'Price source/review note required');
  }
  const catalog = new Map();
  for (const model of book.models) {
    if (!plain(model)) reject('INVALID_PRICE_BOOK', 'Model entry must be an object');
    identifier(model.id, 'model ID');
    if (catalog.has(model.id)) reject('INVALID_PRICE_BOOK', 'Duplicate model ID');
    const entry = {
      id: model.id,
      modality: model.modality,
      inputUsdMicrosPerMillion: integer(model.inputUsdMicrosPerMillion, 0, 1_000_000_000, 'input price'),
      cachedInputUsdMicrosPerMillion: integer(model.cachedInputUsdMicrosPerMillion, 0, 1_000_000_000, 'cached price'),
      outputUsdMicrosPerMillion: integer(model.outputUsdMicrosPerMillion, 0, 1_000_000_000, 'output price'),
      maxInputTokens: integer(model.maxInputTokens, 1, MAX_TOKENS, 'input limit'),
      maxOutputTokens: integer(model.maxOutputTokens, 1, MAX_TOKENS, 'output limit'),
    };
    if (entry.modality !== 'text') reject('UNSUPPORTED', 'Only text token models are supported');
    if (entry.inputUsdMicrosPerMillion === 0 && entry.outputUsdMicrosPerMillion === 0) {
      reject('INVALID_PRICE_BOOK', 'Zero-cost catalog entry not permitted');
    }
    if (entry.cachedInputUsdMicrosPerMillion > entry.inputUsdMicrosPerMillion) {
      reject('INVALID_PRICE_BOOK', 'Cached input rate cannot exceed standard input rate');
    }
    catalog.set(entry.id, Object.freeze(entry));
  }
  return Object.freeze({ version: book.version, reviewedAt: book.reviewedAt, expiresAt: book.expiresAt,
    source: book.source, simulation: true, models: catalog });
}

export function calculateSccCost({ book, modelId, usage, fxKrwPerUsdMilli, targetMarginBps, krwPerScc }) {
  if (!book || !(book.models instanceof Map)) reject('INVALID_PRICE_BOOK', 'Use a validated price book');
  identifier(modelId, 'model ID');
  const model = book.models.get(modelId);
  if (!model) reject('UNSUPPORTED', 'Unknown model; no automatic pricing fallback');
  if (!plain(usage)) reject('INVALID_INPUT', 'Usage object required');
  const inputTokens = integer(usage.inputTokens, 0, model.maxInputTokens, 'input tokens');
  const outputTokens = integer(usage.outputTokens, 0, model.maxOutputTokens, 'output tokens');
  const cachedInputTokens = integer(usage.cachedInputTokens, 0, inputTokens, 'cached tokens');
  if (inputTokens + outputTokens === 0) reject('INVALID_INPUT', 'Usage cannot be empty');
  integer(fxKrwPerUsdMilli, 1, 10_000_000, 'FX rate in KRW per USD times 1000');
  integer(targetMarginBps, 0, 9000, 'target gross margin basis points');
  integer(krwPerScc, 1, 10_000, 'simulation KRW per SCC');
  const billedInput = BigInt(inputTokens - cachedInputTokens);
  const billedCached = BigInt(cachedInputTokens);
  const billedOutput = BigInt(outputTokens);
  const subtotal = billedInput * BigInt(model.inputUsdMicrosPerMillion) +
    billedCached * BigInt(model.cachedInputUsdMicrosPerMillion) +
    billedOutput * BigInt(model.outputUsdMicrosPerMillion);
  const providerUsdMicros = ceilDiv(subtotal, MICROS_PER_MILLION_TOKENS);
  const providerKrw = ceilDiv(providerUsdMicros * BigInt(fxKrwPerUsdMilli),
    MICROS_PER_USD * KRW_FX_SCALE);
  const billableKrw = ceilDiv(providerKrw * 10_000n, BigInt(10_000 - targetMarginBps));
  const chargeScc = billableKrw === 0n ? 1n : ceilDiv(billableKrw, BigInt(krwPerScc));
  return Object.freeze({ modelId, priceVersion: book.version, usage: Object.freeze({ inputTokens, outputTokens,
    cachedInputTokens }), providerUsdMicros: safeNumber(providerUsdMicros),
    providerKrw: safeNumber(providerKrw), billableKrw: safeNumber(billableKrw),
    chargeScc: safeNumber(chargeScc), simulated: true });
}

export function createSccMeter({ ledger, priceBook, fxKrwPerUsdMilli, targetMarginBps,
  krwPerScc, maxSccPerRequest, now = () => Date.now(), quoteTtlMs = 600_000 } = {}) {
  if (!ledger || typeof ledger.snapshot !== 'function' || typeof ledger.reserve !== 'function' ||
      typeof ledger.settleReservation !== 'function' || typeof ledger.releaseReservation !== 'function') {
    reject('INVALID_INPUT', 'SCC sandbox ledger required');
  }
  const book = validatePriceBook(priceBook);
  integer(fxKrwPerUsdMilli, 1, 10_000_000, 'FX rate');
  integer(targetMarginBps, 0, 9000, 'margin');
  integer(krwPerScc, 1, 10_000, 'KRW per SCC');
  integer(maxSccPerRequest, 1, 1_000_000, 'per-request cap');
  integer(quoteTtlMs, 1000, 3_600_000, 'quote TTL');
  if (typeof now !== 'function') reject('INVALID_INPUT', 'Clock function required');
  const quotes = new Map();
  const time = () => integer(now(), 0, 8_640_000_000_000_000, 'clock');
  const pricing = (modelId, usage) => calculateSccCost({ book, modelId, usage,
    fxKrwPerUsdMilli, targetMarginBps, krwPerScc });
  const copy = value => structuredClone(value);

  function preview({ accountId, operationId, modelId, maxInputTokens, maxOutputTokens } = {}) {
    identifier(accountId, 'account ID');
    identifier(operationId, 'operation ID');
    if (operationId.length > 40) reject('INVALID_INPUT', 'Operation ID too long');
    const request = JSON.stringify({ accountId, operationId, modelId, maxInputTokens, maxOutputTokens });
    const existing = quotes.get(operationId);
    if (existing) {
      if (existing.request !== request) reject('CONFLICT', 'Operation already quoted with different inputs');
      return copy(existing.preview);
    }
    const at = time();
    const expires = Date.parse(book.expiresAt);
    if (at < Date.parse(book.reviewedAt) || at >= expires) reject('STALE_PRICE', 'Pricing review is not currently valid');
    if (quotes.size >= 100) reject('LIMIT', 'Too many sandbox quotes');
    const expected = pricing(modelId, { inputTokens: maxInputTokens, outputTokens: maxOutputTokens,
      cachedInputTokens: 0 });
    if (expected.chargeScc > maxSccPerRequest) reject('BUDGET', 'Request exceeds permitted SCC cap');
    const available = ledger.snapshot(accountId).total_available;
    if (!Number.isSafeInteger(available) || available < expected.chargeScc) {
      reject('INSUFFICIENT', 'Not enough SCC for conservative preflight estimate');
    }
    const validUntil = Math.min(at + quoteTtlMs, expires);
    const hold = ledger.reserve({ accountId, reservationId: 'meter_' + operationId,
      credits: expected.chargeScc, expiresAt: new Date(validUntil).toISOString(),
      idempotencyKey: 'meter_reserve_' + operationId });
    const result = { accountId, operationId, modelId, maxInputTokens, maxOutputTokens,
      maxChargeScc: expected.chargeScc, worstCaseProviderKrw: expected.providerKrw,
      availableAtPreview: available, availableAfterReservation: hold.balance.total_available,
      reservedScc: expected.chargeScc, priceVersion: book.version,
      fxKrwPerUsdMilli, quotedAt: new Date(at).toISOString(),
      validUntil: new Date(validUntil).toISOString(), reservationCreated: true, simulated: true };
    quotes.set(operationId, { request, preview: result, settlement: null, settledUsage: null,
      cancellation: null });
    return copy(result);
  }

  function settle({ accountId, operationId, usage } = {}) {
    identifier(accountId, 'account ID');
    identifier(operationId, 'operation ID');
    const quote = quotes.get(operationId);
    if (!quote || quote.preview.accountId !== accountId) reject('NOT_FOUND', 'Unknown quote');
    const fingerprint = JSON.stringify(usage);
    if (quote.settlement) {
      if (quote.settledUsage !== fingerprint) reject('CONFLICT', 'Usage cannot change after settlement');
      return copy(quote.settlement);
    }
    if (quote.cancellation) reject('CONFLICT', 'Reservation has been released');
    if (time() >= Date.parse(quote.preview.validUntil)) reject('EXPIRED', 'Quote has expired');
    const cost = pricing(quote.preview.modelId, usage);
    if (cost.usage.inputTokens > quote.preview.maxInputTokens ||
        cost.usage.outputTokens > quote.preview.maxOutputTokens ||
        cost.chargeScc > quote.preview.maxChargeScc) {
      reject('BUDGET', 'Usage exceeds accepted quote');
    }
    const debited = ledger.settleReservation({ accountId, credits: cost.chargeScc,
      reservationId: 'meter_' + operationId, idempotencyKey: 'meter_settle_' + operationId });
    const allocations = debited.event.allocations;
    const result = { operationId, accountId, priceVersion: book.version, cost,
      debitedScc: cost.chargeScc, reservedScc: quote.preview.reservedScc,
      releasedScc: debited.event.releasedCredits,
      bonusDebitedScc: allocations.filter(x => x.source === 'BONUS').reduce((n, x) => n + x.credits, 0),
      paidDemoDebitedScc: allocations.filter(x => x.source === 'PAID_DEMO').reduce((n, x) => n + x.credits, 0),
      remainingScc: debited.balance.total_available, paidCashVerified: false, simulated: true };
    quote.settledUsage = fingerprint;
    quote.settlement = copy(result);
    return copy(result);
  }
  function cancel({ accountId, operationId } = {}) {
    identifier(accountId, 'account ID');
    identifier(operationId, 'operation ID');
    const quote = quotes.get(operationId);
    if (!quote || quote.preview.accountId !== accountId) reject('NOT_FOUND', 'Unknown quote');
    if (quote.settlement) reject('CONFLICT', 'Settled reservations cannot be cancelled');
    if (quote.cancellation) return copy(quote.cancellation);
    const released = ledger.releaseReservation({ accountId,
      reservationId: 'meter_' + operationId, idempotencyKey: 'meter_release_' + operationId });
    const result = { accountId, operationId, status: released.event.status,
      releasedScc: released.event.credits, remainingScc: released.balance.total_available,
      paidCashRefunded: false, simulated: true };
    quote.cancellation = copy(result);
    return copy(result);
  }
  return Object.freeze({ preview, settle, cancel });
}
