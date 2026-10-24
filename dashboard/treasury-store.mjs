// Local Devnet policy approvals. No transaction signing, broadcasting or custody.
import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import ShahCat from './shared.js';
import Policy from './tokenomics.js';
export const IDS = ['seongjae', 'dongwon', 'parkwon'];
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
function fail(message, status = 400) { throw Object.assign(Error(message), { status }); }
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail('알 수 없는 입력 필드');
}
function text(value, name, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b-\x1f]/.test(value)) fail(name + ' 입력을 확인하세요.');
  return value.trim();
}
function raw(value, name, allowZero = false) {
  try { const n = ShahCat.rawAmount(value); if (!allowZero && !n) throw Error(); return String(n); }
  catch { fail(name + ' 수량을 확인하세요.'); }
}
function iso(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('UTC 일시 형식 오류');
  return value;
}
export function validateConfig(input) {
  Policy.assertProfile();
  keys(input, ['network', 'mint', 'treasury', 'signers']);
  if (input.network !== 'devnet' || input.mint !== Policy.MINT || !ShahCat.isPublicKey(input.treasury)) fail('SHAH Devnet 재무 설정 오류');
  keys(input.signers, IDS);
  const signers = Object.fromEntries(IDS.map(id => {
    const address = input.signers[id];
    if (!ShahCat.isPublicKey(address)) fail(id + ' 공개 주소가 필요합니다.');
    return [id, address];
  }));
  if (new Set(Object.values(signers)).size !== 3) fail('서명자 3명의 주소는 서로 달라야 합니다.');
  return { network: 'devnet', mint: Policy.MINT, treasury: input.treasury, signers };
}
function publicKey(address) {
  let n = 0n;
  for (const c of address) n = n * 58n + BigInt(alphabet.indexOf(c));
  const bytes = Buffer.alloc(32);
  for (let i = 31; i >= 0; --i) { bytes[i] = Number(n & 255n); n >>= 8n; }
  return createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), bytes]), format: 'der', type: 'spki' });
}
function checkSignature(address, message, signature) {
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) fail('64바이트 base64 서명이 필요합니다.');
  const bytes = Buffer.from(signature, 'base64');
  if (bytes.toString('base64') !== signature || !verify(null, Buffer.from(message), publicKey(address), bytes)) fail('지갑 서명 검증 실패', 403);
}
function normalize(input, config) {
  keys(input, ['kind', 'purpose', 'evidence', 'amountRaw', 'feeCapLamports', 'startsAt', 'expiresAt', 'recipient', 'conflicts', 'budgetId']);
  if (!['budget', 'spend', 'exception', 'reserve'].includes(input.kind)) fail('요청 종류 오류');
  const isBudget = input.kind === 'budget';
  const result = { kind: input.kind, network: 'devnet', mint: Policy.MINT, treasury: config.treasury,
    purpose: text(input.purpose, '목적', 500), evidence: text(input.evidence, '증빙 또는 근거', 2000),
    amountRaw: raw(input.amountRaw, 'SHAH'), feeCapLamports: raw(input.feeCapLamports, 'SOL 수수료 상한', true),
    startsAt: iso(input.startsAt), expiresAt: iso(input.expiresAt), recipient: isBudget ? null : input.recipient,
    conflicts: [], budgetId: input.kind === 'spend' ? text(input.budgetId, '예산 ID', 80) : null };
  if (Date.parse(result.expiresAt) <= Date.parse(result.startsAt)) fail('종료일은 시작일 이후여야 합니다.');
  if (isBudget && result.startsAt.slice(0, 7) !== new Date(Date.parse(result.expiresAt) - 1).toISOString().slice(0, 7)) fail('예산은 한 UTC 월 안에서 설정하세요.');
  if (!isBudget && (!ShahCat.isPublicKey(result.recipient) || result.recipient === config.treasury)) fail('수령 공개 주소를 확인하세요.');
  if (!Array.isArray(input.conflicts) || input.conflicts.some(id => !IDS.includes(id)) || new Set(input.conflicts).size !== input.conflicts.length) fail('이해관계자 입력 오류');
  result.conflicts = IDS.filter(id => input.conflicts.includes(id) || config.signers[id] === result.recipient);
  if (isBudget && result.conflicts.length) fail('이해상충 예산은 별도 정책 검토가 필요합니다.');
  if (isBudget && input.recipient) fail('예산에 수령 주소를 지정할 수 없습니다.');
  if (input.kind !== 'spend' && input.budgetId) fail('일반 지출만 예산을 연결합니다.');
  return result;
}
function eligible(proposal) { return IDS.filter(id => !proposal.content.conflicts.includes(id)); }
function threshold(proposal) { return proposal.content.kind === 'spend' ? 2 : 3; }
function approved(proposal) { return proposal.approvals.length >= threshold(proposal); }

function decisionText(store, p, signer, decision) {
  return 'SHAH CAT Treasury policy decision v1\nNOT A TRANSACTION. DEVNET ONLY.\n' + JSON.stringify({ ledgerId: store.ledgerId,
      configHash: store.configHash, policyVersion: '0.5', requestId: p.id, revision: p.revision, nonce: p.nonce, signer,
      address: store.config.signers[signer], decision, budgetRevision: p.budgetRevision,
      display: { amountSHAH: ShahCat.amount(p.content.amountRaw), feeCapSOL: ShahCat.solAmount(p.content.feeCapLamports) }, content: p.content });
}

export class TreasuryStore {
  static async open({ config, path, clock = () => Date.now() }) {
    const store = new TreasuryStore();
    store.config = validateConfig(config); store.path = path; store.clock = clock;
    store.configHash = hash(store.config); store.events = []; store.requests = new Map(); store.tail = Promise.resolve();
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    store.lock = await open(path + '.lock', 'wx', 0o600);
    try {
      await store.lock.writeFile(String(process.pid));
      let data;
      try { data = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (data !== undefined) {
        if (!data.endsWith('\n')) fail('원장 끝이 손상되었습니다. 백업을 확인하세요.', 503);
        const lines = data.slice(0, -1).split('\n');
        for (const line of lines) {
          const event = JSON.parse(line), { digest, ...body } = event;
          if (body.seq !== store.events.length || body.prev !== (store.events.at(-1)?.digest ?? null) || hash(body) !== digest || body.configHash !== store.configHash) fail('원장 또는 서명자 설정이 변경됐습니다.', 503);
          if (body.seq === 0) { if (body.type !== 'init' || typeof body.ledgerId !== 'string') fail('원장 헤더 오류', 503); store.ledgerId = body.ledgerId; }
          else {
            if (body.ledgerId !== store.ledgerId || !['create', 'revise', 'approve', 'reject'].includes(body.type)) fail('원장 이벤트 오류', 503);
            store.verifyLoaded(body.type, body.proposal);
            store.requests.set(body.proposal.id, body.proposal);
          }
          store.events.push(event);
        }
      }
      store.handle = await open(path, 'a', 0o600);
      if (!store.events.length) { store.ledgerId = randomUUID(); await store.append('init', null); }
      return store;
    } catch (error) { await store.close(); throw error; }
  }
  verifyLoaded(type, p) {
    if (!p || typeof p.id !== 'string' || !Number.isSafeInteger(p.revision) || p.revision < 1 || typeof p.nonce !== 'string' || !Array.isArray(p.approvals)) fail('원장 요청 형식 오류', 503);
    const prior = this.requests.get(p.id), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const content = p.content;
    const { network, mint, treasury, ...input } = content;
    if (!same(content, normalize(input, this.config)) || network !== 'devnet' || mint !== Policy.MINT || treasury !== this.config.treasury || eligible(p).length < threshold(p)) fail('원장 정책 불일치', 503);
    if (p.approvals.length > threshold(p) || new Set(p.approvals.map(a => a.signer)).size !== p.approvals.length) fail('원장 승인 중복', 503);
    for (const [decision, votes] of [['approve', p.approvals], ['reject', p.rejectedBy ? [p.rejectedBy] : []]]) {
      for (const vote of votes) {
        if (!eligible(p).includes(vote.signer) || vote.address !== this.config.signers[vote.signer] || vote.message !== decisionText(this, p, vote.signer, decision)) fail('원장 승인 내용 불일치', 503);
        checkSignature(vote.address, vote.message, vote.signature);
      }
    }
    if (type === 'create') {
      if (prior || p.revision !== 1 || p.approvals.length || p.rejectedBy) fail('원장 생성 이력 오류', 503);
    } else {
      if (!prior || approved(prior) || prior.rejectedBy) fail('완료 요청의 원장 변경', 503);
      if (type === 'revise') {
        if (p.revision !== prior.revision + 1 || p.nonce === prior.nonce || p.approvals.length || p.rejectedBy || content.kind !== prior.content.kind) fail('원장 수정 이력 오류', 503);
      } else {
        const before = { ...prior, approvals: [], rejectedBy: null }, after = { ...p, approvals: [], rejectedBy: null };
        if (!same(before, after)) fail('승인 중 요청 내용 변경', 503);
        if (type === 'approve' && (p.rejectedBy || !same(p.approvals.slice(0,-1), prior.approvals) || p.approvals.length !== prior.approvals.length + 1)) fail('원장 승인 이력 오류', 503);
        if (type === 'reject' && (!p.rejectedBy || !same(p.approvals, prior.approvals))) fail('원장 반려 이력 오류', 503);
      }
    }
  }
  async close() {
    this.closing = true;
    await this.tail?.catch(() => {});
    await this.handle?.close(); await this.lock?.close();
    if (this.lock) { await unlink(this.path + '.lock'); this.lock = null; }
  }
  exclusive(action) {
    const next = this.tail.then(() => { if (this.failed || this.closing || !this.lock) fail('원장 쓰기가 중단됐습니다.', 503); return action(); });
    this.tail = next.catch(() => {}); return next;
  }
  async append(type, proposal) {
    const body = { seq: this.events.length, prev: this.events.at(-1)?.digest ?? null, ledgerId: this.ledgerId,
      configHash: this.configHash, at: new Date(this.clock()).toISOString(), type, proposal };
    const event = { ...body, digest: hash(body) };
    try { await this.handle.writeFile(JSON.stringify(event) + '\n'); await this.handle.sync(); }
    catch (error) { this.failed = true; throw error; }
    this.events.push(event); if (proposal) this.requests.set(proposal.id, proposal);
  }
  get(id) { const p = this.requests.get(id); if (!p) fail('요청을 찾을 수 없습니다.', 404); return clone(p); }
  view(p) {
    const expired = this.clock() >= Date.parse(p.content.expiresAt);
    let dependencyValid = true;
    if (p.content.kind === 'spend') {
      const budget = this.requests.get(p.content.budgetId);
      dependencyValid = !!budget && approved(budget) && !budget.rejectedBy && budget.revision === p.budgetRevision;
    }
    return { ...clone(p), eligible: eligible(p), required: threshold(p), dependencyValid,
      status: p.rejectedBy ? 'rejected' : expired ? 'expired' : !dependencyValid ? 'budget_invalid' : approved(p) ? 'policy_approved' : 'pending',
      executionEnabled: false, onchainMultisigVerified: false };
  }
  snapshot() {
    return { enabled: true, policyVersion: '0.5', network: 'devnet', mint: Policy.MINT, config: clone(this.config),
      configHash: this.configHash, ledgerId: this.ledgerId, executionEnabled: false, onchainMultisigVerified: false,
      treasurySignerIds: IDS.filter(id => this.config.signers[id] === this.config.treasury),
      requests: [...this.requests.values()].map(p => this.view(p)), events: clone(this.events) };
  }
  checkBudget(content, excludeId = null) {
    if (content.kind !== 'spend') return null;
    const budget = this.requests.get(content.budgetId);
    if (!budget || budget.content.kind !== 'budget' || !approved(budget) || budget.rejectedBy || this.clock() >= Date.parse(budget.content.expiresAt)) fail('유효한 전원 승인 예산이 필요합니다.', 409);
    if (content.startsAt < budget.content.startsAt || content.expiresAt > budget.content.expiresAt) fail('지출 기간이 예산 범위를 벗어났습니다.', 409);
    let reserved = 0n, fees = 0n;
    for (const p of this.requests.values()) {
      if (p.id === excludeId || p.content.budgetId !== budget.id || p.budgetRevision !== budget.revision || !approved(p) || p.rejectedBy) continue;
      // Conservative: even expired approvals keep their reservation until separately reviewed.
      reserved += BigInt(p.content.amountRaw); fees += BigInt(p.content.feeCapLamports);
    }
    if (reserved + BigInt(content.amountRaw) > BigInt(budget.content.amountRaw) || fees + BigInt(content.feeCapLamports) > BigInt(budget.content.feeCapLamports)) fail('누적 승인액 또는 수수료가 예산 한도를 초과합니다.', 409);
    return budget.revision;
  }
  create(content) { return this.exclusive(async () => {
    const normalized = normalize(content, this.config);
    if (Date.parse(normalized.expiresAt) <= this.clock()) fail('이미 만료된 요청입니다.');
    const p = { id: randomUUID(), revision: 1, nonce: randomUUID(), content: normalized, budgetRevision: this.checkBudget(normalized), approvals: [], rejectedBy: null };
    if (eligible(p).length < threshold(p)) fail('이해관계자를 제외하면 승인 정족수를 충족할 수 없습니다.');
    await this.append('create', p); return this.view(p);
  }); }
  revise(id, revision, content) { return this.exclusive(async () => {
    const old = this.get(id);
    if (revision !== old.revision) fail('요청 버전이 변경됐습니다.', 409);
    if (approved(old) || old.rejectedBy) fail('승인 완료 또는 반려 요청은 변경할 수 없습니다. 새 요청을 만드세요.', 409);
    if ([...this.requests.values()].some(p => p.content.budgetId === id)) fail('연결 지출이 있는 예산은 수정할 수 없습니다.', 409);
    const normalized = normalize(content, this.config);
    if (normalized.kind !== old.content.kind || Date.parse(normalized.expiresAt) <= this.clock()) fail('종류 변경 또는 만료된 요청');
    const p = { ...old, revision: revision + 1, nonce: randomUUID(), content: normalized,
      budgetRevision: this.checkBudget(normalized, id), approvals: [], rejectedBy: null };
    if (eligible(p).length < threshold(p)) fail('승인 정족수 부족');
    await this.append('revise', p); return this.view(p);
  }); }
  message(id, revision, signer, decision) {
    const p = this.get(id);
    if (p.revision !== revision) fail('요청 버전이 변경됐습니다.', 409);
    if (!eligible(p).includes(signer) || !['approve', 'reject'].includes(decision)) fail('승인 권한이 없습니다.', 403);
    if (p.rejectedBy || approved(p) || this.clock() >= Date.parse(p.content.expiresAt)) fail('이미 완료되거나 만료된 요청입니다.', 409);
    return decisionText(this, p, signer, decision);
  }
  decide(input) { return this.exclusive(async () => {
    keys(input, ['id', 'revision', 'signer', 'decision', 'signature']);
    const message = this.message(input.id, input.revision, input.signer, input.decision);
    const p = this.get(input.id);
    if (p.approvals.some(a => a.signer === input.signer)) fail('이미 승인한 서명자입니다.', 409);
    checkSignature(this.config.signers[input.signer], message, input.signature);
    if (input.decision === 'approve') {
      this.checkBudget(p.content, p.id);
      p.approvals.push({ signer: input.signer, address: this.config.signers[input.signer], signature: input.signature, message, at: new Date(this.clock()).toISOString() });
    } else p.rejectedBy = { signer: input.signer, address: this.config.signers[input.signer], signature: input.signature, message, at: new Date(this.clock()).toISOString() };
    await this.append(input.decision, p); return this.view(p);
  }); }
}
