import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { calculateQuote, validateDraft, demoTemplate, createHandler, openAIProducer } from './server.mjs';

const validDraft = { kind: 'post', platform: 'naver', tone: 'warm',
  brief: '부산 지역 스포츠 안경점의 러닝 안경을 소개해 주세요.', rightsOk: true, externalOk: true };

function quote(overrides = {}) {
  return { paid_krw: 300000, cash_cost_krw: 80000, labor_hours: 5,
    labor_rate_krw: 30000, fee_krw: 10000, refund_krw: 0, ...overrides };
}

test('contribution is net revenue minus direct cash, labor and fees', () => {
  assert.deepEqual(calculateQuote(quote()), {
    net_revenue_krw: 300000, labor_cost_krw: 150000, contribution_krw: 60000,
    margin_pct: 20, note: '인건비 포함 건별 기여이익 추정. 세금·고정비·미래 수정비 제외.',
  });
  assert.equal(calculateQuote(quote({ refund_krw: 100000 })).contribution_krw, -40000);
  assert.equal(calculateQuote(quote({ paid_krw: 0 })).margin_pct, null);
});

test('invalid quote fields fail closed', () => {
  for (const changes of [{ paid_krw: -1 }, { labor_hours: 0.1 }, { paid_krw: NaN },
    { fee_krw: '1000' }, { refund_krw: 300001 }]) {
    assert.throws(() => calculateQuote(quote(changes)), e => e.status === 400);
  }
});

test('draft validation requires content and rights, and optional external consent', () => {
  assert.deepEqual(validateDraft(validDraft, 'demo').kind, 'post');
  assert.throws(() => validateDraft({ ...validDraft, rightsOk: false }), e => e.status === 400);
  assert.throws(() => validateDraft({ ...validDraft, kind: 'danger' }), e => e.status === 400);
  assert.throws(() => validateDraft({ ...validDraft, brief: 'short' }), e => e.status === 400);
  assert.throws(() => validateDraft({ ...validDraft, externalOk: false }, 'openai'), e => e.status === 400);
  assert.match(demoTemplate(validateDraft(validDraft)), /AI가 생성한 콘텐츠가 아닌/);
});

async function startServer(opts = {}) {
  let handler;
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  handler = createHandler({ mode: 'demo', ...opts, port: server.address().port });
  return { base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}

async function post(base, path, body, headers = {}) {
  return fetch(base + path, { method: 'POST', headers: {
    'content-type': 'application/json', 'x-studio-request': '1', origin: base, ...headers,
  }, body: JSON.stringify(body) });
}

test('local UI and demo endpoints function with zero external calls', async t => {
  const { base, close } = await startServer(); t.after(close);
  const page = await fetch(base); assert.equal(page.status, 200);
  assert.match(await page.text(), /SHAH CAT Creative Studio/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await (await fetch(base + '/api/config')).json()).mode, 'demo');
  const draft = await post(base, '/api/draft', validDraft);
  assert.equal(draft.status, 200);
  const result = await draft.json();
  assert.equal(result.reviewRequired, true);
  assert.match(result.content, /수동 작성용 템플릿/);
  const estimate = await post(base, '/api/quote', quote());
  assert.equal((await estimate.json()).contribution_krw, 60000);
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/../server.mjs')).status, 404);
});

test('HTTP rejects cross-origin writes, missing custom header and oversized or malformed inputs', async t => {
  const { base, close } = await startServer(); t.after(close);
  assert.equal((await post(base, '/api/draft', validDraft, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(base + '/api/draft', { method: 'POST', headers: {
    'content-type': 'application/json' }, body: JSON.stringify(validDraft) })).status, 403);
  assert.equal((await post(base, '/api/draft', { ...validDraft, brief: 'x'.repeat(9000) })).status, 413);
  assert.equal((await post(base, '/api/draft', { ...validDraft, rightsOk: false })).status, 400);
  assert.equal((await post(base, '/api/quote', quote({ paid_krw: -1 }))).status, 400);
  assert.equal((await fetch(base + '/api/config', { method: 'POST' })).status, 405);
});

test('provider is called only after rights and external-transfer consent', async t => {
  let called = 0;
  const { base, close } = await startServer({ mode: 'openai', producer: async () => { called++; return 'AI 초안입니다'; } });
  t.after(close);
  const denied = await post(base, '/api/draft', { ...validDraft, externalOk: false });
  assert.equal(denied.status, 400); assert.equal(called, 0);
  const allowed = await post(base, '/api/draft', validDraft);
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).content, 'AI 초안입니다');
  assert.equal(called, 1);
});

test('OpenAI adapter uses fixed endpoint, store=false and never returns raw upstream error', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'test-key'; process.env.OPENAI_MODEL = 'test-model';
  try {
    let request;
    const result = await openAIProducer({ kind: 'post', brief: 'test' }, async (url, opts) => {
      request = { url, opts };
      return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: '초안' }] }] }) };
    });
    assert.equal(result, '초안');
    assert.equal(request.url, 'https://api.openai.com/v1/responses');
    assert.equal(JSON.parse(request.opts.body).store, false);
    await assert.rejects(openAIProducer({}, async () => ({ ok: false, status: 401 })),
      e => e.status === 502 && !e.message.includes('test-key'));
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previousModel;
  }
});

const workflowBrief = { ...validDraft, brand: '구름문구 (가상)', industry: '문구 소품', purpose: '새 노트 소개', audience: '기록을 즐기는 성인', channel: 'naver-cafe', length: 'medium' };
const allChecks = { edited: true, rights: true, facts: true, commercial: true, likeness: true };
async function transition(base, record, action, extra = {}) {
  return post(base, '/api/workflow/action', { id: record.id, revision: record.revision, action, ...extra });
}
for (const channel of ['naver-cafe', 'naver-blog', 'discord']) {
  test(`${channel}: offline draft, edit, review, approve and both exports`, async t => {
    const { base, close } = await startServer({ producer: () => { throw Error('No external calls in demo'); } }); t.after(close);
    const input = { ...workflowBrief, channel };
    let record = await (await post(base, '/api/workflow', input)).json();
    assert.equal(record.state, 'DRAFT'); assert.equal(record.published, false);
    assert.equal(record.content.metadata.channelId, channel);
    assert.match(record.content.post, /DEMO/); assert.match(record.content.hashtags, /#/);
    assert.match(record.content.imagePrompt, /이미지 API 호출 없이/);
    assert.equal(record.content.metadata.imageGenerated, false);
    const repeated = await (await post(base, '/api/workflow', input)).json();
    assert.deepEqual(repeated.content, record.content);
    assert.equal((await transition(base, record, 'export', { format: 'json' })).status, 409);
    assert.equal((await transition(base, record, 'approve', { checks: allChecks })).status, 409);
    const old = record;
    record = await (await transition(base, record, 'edit', { content: { ...record.content, post: '사람이 수정한 가상 브랜드 안내' } })).json();
    assert.equal((await transition(base, old, 'review')).status, 409);
    record = await (await transition(base, record, 'review')).json();
    assert.equal(record.state, 'REVIEW_REQUIRED');
    for (const key of Object.keys(allChecks)) {
      assert.equal((await transition(base, record, 'approve', { checks: { ...allChecks, [key]: false } })).status, 400);
      assert.equal((await transition(base, record, 'approve', { checks: { ...allChecks, [key]: 'true' } })).status, 400);
    }
    assert.equal((await transition(base, record, 'export', { format: 'markdown', state: 'APPROVED', checks: allChecks })).status, 409);
    const prior = record;
    record = await (await transition(base, record, 'approve', { checks: allChecks })).json();
    assert.equal(record.state, 'APPROVED');
    assert.equal((await transition(base, prior, 'approve', { checks: allChecks })).status, 409);
    assert.equal((await transition(base, record, 'export', { format: 'html' })).status, 400);
    const exported = await (await transition(base, record, 'export', { format: 'json' })).json();
    assert.equal(exported.state, 'EXPORTED'); assert.equal(exported.published, false);
    const file = JSON.parse(exported.output);
    assert.equal(file.content.post, '사람이 수정한 가상 브랜드 안내'); assert.deepEqual(file.checks, allChecks);
    assert.equal(file.content.metadata.published, false);
    const markdown = await (await transition(base, exported, 'export', { format: 'markdown' })).json();
    assert.match(markdown.output, /    사람이 수정한 가상 브랜드 안내/);
    record = await (await transition(base, exported, 'edit', { content: { ...exported.content, post: '승인 후 변경' } })).json();
    assert.equal(record.state, 'DRAFT'); assert.equal(record.checks, null);
    assert.equal((await transition(base, exported, 'export', { format: 'json' })).status, 409);
    assert.equal((await transition(base, record, 'export', { format: 'json' })).status, 409);
    assert.equal((await transition(base, { ...record, id: 'invented' }, 'review')).status, 404);
    assert.equal((await post(base, '/api/publish', record)).status, 404);
  });
}

test('workflow rejects invalid briefs and rights/consent before any provider call', async t => {
  let calls = 0;
  const { base, close } = await startServer({ mode: 'openai', producer: async input => { calls++; assert.equal(input.brand, workflowBrief.brand); return '모의 AI 초안'; } }); t.after(close);
  for (const change of [{ rightsOk: false }, { externalOk: false }, { brand: '' }, { brand: 'x'.repeat(81) },
    { audience: [] }, { purpose: 'x'.repeat(301) }, { industry: '\u0000bad' }, { channel: 'instagram' }, { length: 'huge' },
    { brief: 'x'.repeat(2001) }, { tone: 'evil' }, { kind: 'evil' }]) {
    assert.equal((await post(base, '/api/workflow', { ...workflowBrief, ...change })).status, 400);
  }
  assert.equal(calls, 0);
  const record = await (await post(base, '/api/workflow', workflowBrief)).json();
  assert.equal(calls, 1); assert.equal(record.content.post, '모의 AI 초안'); assert.equal(record.state, 'DRAFT');
});

test('Host, Origin, MIME, oversized requests and unsupported methods fail closed', async t => {
  const { base, close } = await startServer(); t.after(close);
  for (const route of ['/api/workflow', '/api/workflow/action', '/api/draft', '/api/quote']) {
    for (const origin of ['', 'null', 'https://evil.example', base + '.evil.example']) {
      assert.equal((await post(base, route, workflowBrief, { origin })).status, 403);
    }
    assert.equal((await post(base, route, workflowBrief, { 'x-studio-request': '' })).status, 403);
  }
  const badHost = await new Promise(resolve => {
    http.get(base, { headers: { host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); });
  }); assert.equal(badHost, 403);
  const noOrigin = await fetch(base + '/api/workflow', { method: 'POST', headers: { 'content-type': 'application/json', 'x-studio-request': '1' }, body: JSON.stringify(workflowBrief) });
  assert.equal(noOrigin.status, 403);
  assert.equal((await post(base, '/api/workflow', workflowBrief, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post(base, '/api/workflow', { ...workflowBrief, brief: 'x'.repeat(66000) })).status, 413);
  assert.equal((await fetch(base + '/api/workflow')).status, 405);
  assert.equal((await fetch(base + '/workflow.mjs')).status, 404);
  const malformed = await fetch(base + '/api/workflow', { method: 'POST', headers: { origin: base, 'content-type': 'application/json', 'x-studio-request': '1' }, body: '{' });
  assert.equal(malformed.status, 400);
});

test('hostile content stays inert and invalid edits cannot retain approval', async t => {
  const { base, close } = await startServer(); t.after(close);
  let record = await (await post(base, '/api/workflow', { ...workflowBrief, brand: '<script>alert(1)</script>' })).json();
  const hostile = '<script>alert(1)</script>\n[click](javascript:evil)\n```html';
  record = await (await transition(base, record, 'edit', { content: { ...record.content, post: hostile } })).json();
  for (const changes of [{ post: '' }, { post: 'x'.repeat(15001) }, { imagePrompt: null }, { hashtags: 'x'.repeat(301) }]) {
    assert.equal((await transition(base, record, 'edit', { content: { ...record.content, ...changes } })).status, 400);
  }
  record = await (await transition(base, record, 'review')).json();
  record = await (await transition(base, record, 'approve', { checks: allChecks })).json();
  const output = await (await transition(base, record, 'export', { format: 'markdown' })).json();
  assert.match(output.output, /\n    <script>/); assert.doesNotMatch(output.output, /\n<script>/);
  assert.match(output.output, /\n    \[click\]/);
});

test('AI failures are sanitized and never create an approved workflow', async t => {
  const { base, close } = await startServer({ mode: 'openai', producer: async () => { throw Error('private-upstream-detail'); } }); t.after(close);
  const response = await post(base, '/api/workflow', workflowBrief);
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-upstream-detail/);
});

test('quote explicitly includes AI/revision costs and separates internal work', () => {
  const input = quote({ ai_cost_krw: 20000, revision_cost_krw: 50000, revenue_source: 'external' });
  assert.equal(calculateQuote(input).contribution_krw, -10000);
  assert.equal(calculateQuote(input).margin_pct, -3.3);
  for (const key of ['ai_cost_krw', 'revision_cost_krw']) for (const value of [-1, 0.1, null, '0', Infinity, NaN, 50000001]) {
    assert.throws(() => calculateQuote({ ...input, [key]: value }), e => e.status === 400);
  }
  assert.throws(() => calculateQuote({ ...input, revenue_source: 'internal' }), e => e.status === 400);
  assert.throws(() => calculateQuote({ ...input, revenue_source: 'SHAH' }), e => e.status === 400);
  const internal = calculateQuote({ ...input, revenue_source: 'internal', paid_krw: 0 });
  assert.equal(internal.net_revenue_krw, 0); assert.equal(internal.margin_pct, null); assert.ok(internal.contribution_krw < 0);
  assert.match(internal.note, /내부 제작/);
});

test('upstream malformed shape, empty, excessive output and timeout errors are normalized', async () => {
  const key = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'synthetic-test'; process.env.OPENAI_MODEL = 'synthetic-test';
  try {
    for (const data of [null, {}, { output: {} }, { output: [null] }, { output: [{ content: {} }] }, { output: [{ content: [null] }] },
      { output: [] }, { output: [{ content: [{ type: 'output_text', text: 'x'.repeat(15001) }] }] }]) {
      await assert.rejects(openAIProducer({}, async () => ({ ok: true, json: async () => data })), e => e.status === 502);
    }
    await assert.rejects(openAIProducer({}, async (_url, opts) => {
      assert.ok(opts.signal instanceof AbortSignal); assert.equal(opts.redirect, 'error'); throw Error('timeout-private');
    }), e => e.status === 502 && !e.message.includes('timeout-private'));
    await assert.rejects(openAIProducer({}, async () => ({ ok: true, json: async () => { throw Error('private'); } })), e => e.status === 502);
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key;
    if (model === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = model;
  }
});

test('shared generation rate, bounded memory and expiration', async t => {
  const { base, close } = await startServer(); t.after(close);
  const now = Date.now; let offset = 0;
  t.mock.method(Date, 'now', () => now() + offset);
  let record;
  for (let batch = 0; batch < 2; batch++) {
    for (let i = 0; i < 12; i++) {
      const response = await post(base, '/api/workflow', workflowBrief); assert.equal(response.status, 200);
      record = await response.json();
    }
    assert.equal((await post(base, '/api/draft', validDraft)).status, 429);
    offset += 600001;
  }
  assert.equal((await post(base, '/api/workflow', workflowBrief)).status, 429);
  offset += 3600001;
  assert.equal((await transition(base, record, 'review')).status, 404);
  assert.equal((await post(base, '/api/workflow', workflowBrief)).status, 200);
});

test('concurrent approval/edit cannot export a changed revision with stale approval', async t => {
  const { base, close } = await startServer(); t.after(close);
  let record = await (await post(base, '/api/workflow', workflowBrief)).json();
  record = await (await transition(base, record, 'review')).json();
  const responses = await Promise.all([
    transition(base, record, 'approve', { checks: allChecks }),
    transition(base, record, 'edit', { content: { ...record.content, post: '경쟁 수정' } }),
  ]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const winner = await responses.find(r => r.status === 200).json();
  if (winner.state === 'APPROVED') {
    const edited = await (await transition(base, winner, 'edit', { content: { ...winner.content, post: '새 내용' } })).json();
    assert.equal(edited.state, 'DRAFT');
    assert.equal((await transition(base, edited, 'export', { format: 'json' })).status, 409);
  } else {
    assert.equal(winner.state, 'DRAFT');
    assert.equal((await transition(base, winner, 'export', { format: 'json' })).status, 409);
  }
});

test('demo reuses validated kind/tone/brief template and honors requested length cap', async t => {
  const { base, close } = await startServer(); t.after(close);
  const normal = await (await post(base, '/api/workflow', { ...workflowBrief, length: 'long', kind: 'product', tone: 'playful' })).json();
  assert.match(normal.content.post, /상품 소개/); assert.match(normal.content.post, /발랄한/);
  assert.match(normal.content.post, /부산 지역 스포츠/);
  const short = await (await post(base, '/api/workflow', { ...workflowBrief, length: 'short' })).json();
  assert.ok(short.content.post.length <= 250);
});

// Execute the shipped browser script with form/event doubles, not a duplicated consent implementation.
async function consentUI() {
  const source = await readFile(new URL('./studio.js', import.meta.url), 'utf8');
  const nodes = new Map();
  function node(name = '') {
    const listeners = new Map();
    return { name, value: 'synthetic brief for consent regression', checked: false, disabled: false,
      classList: { toggle() {} }, addEventListener(type, fn) { listeners.set(type, fn); },
      emit(type, target) { return listeners.get(type)?.({ target, preventDefault() {} }); } };
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const names = ['brand', 'industry', 'purpose', 'audience', 'channel', 'length', 'kind', 'tone', 'brief', 'rightsOk', 'externalOk'];
  const draft = get('draft-form');
  draft.elements = names.map(name => node(name));
  draft.elements.namedItem = name => draft.elements.find(el => el.name === name);
  const approval = get('approval-form'); approval.elements = ['edited', 'rights', 'facts', 'commercial', 'likeness'].map(name => node(name));
  approval.elements.namedItem = name => approval.elements.find(el => el.name === name);
  approval.reset = () => approval.elements.forEach(el => { el.checked = false; });
  const sent = []; let complete;
  vm.runInNewContext(source, {
    document: { getElementById: get },
    FormData: class { constructor(form) { this.form = form; } get(key) {
      const el = this.form.elements.namedItem(key);
      if (el.disabled) return null;
      return ['rightsOk', 'externalOk'].includes(key) ? (el.checked ? 'on' : null) : el.value;
    } },
    fetch: async (path, opts) => {
      if (path === '/api/config') return { ok: true, json: async () => ({ mode: 'openai' }) };
      sent.push(JSON.parse(opts.body));
      return new Promise((resolve, reject) => { complete = ok => ok ? resolve({ ok: true, json: async () => ({
        state: 'DRAFT', revision: 1, content: { post: 'mock', hashtags: '', imagePrompt: 'mock', metadata: {} }, checks: null,
      }) }) : reject(Error('synthetic transport failure')); });
    },
  });
  const control = name => draft.elements.namedItem(name);
  const confirm = () => {
    for (const name of ['rightsOk', 'externalOk']) {
      control(name).checked = true; draft.emit('input', control(name)); draft.emit('change', control(name));
    }
  };
  return { draft, control, confirm, sent, complete: ok => complete(ok) };
}

test('brief-scoped consent is cleared for every changed content field, not when checking consent itself', async () => {
  const ui = await consentUI();
  for (const event of ['input', 'change']) for (const name of ['brand', 'industry', 'purpose', 'audience', 'channel', 'length', 'kind', 'tone', 'brief']) {
    ui.confirm(); assert.equal(ui.control('rightsOk').checked, true); assert.equal(ui.control('externalOk').checked, true);
    ui.control(name).value = 'different synthetic content'; ui.draft.emit(event, ui.control(name));
    assert.equal(ui.control('rightsOk').checked, false, `${event}: ${name} rights`);
    assert.equal(ui.control('externalOk').checked, false, `${event}: ${name} external`);
  }
});

for (const success of [true, false]) test(`submission consumes both confirmations immediately, including ${success ? 'success' : 'failure'}`, async () => {
  const ui = await consentUI(); ui.confirm();
  const pending = ui.draft.emit('submit');
  assert.equal(ui.sent.length, 1); assert.equal(ui.sent[0].rightsOk, true); assert.equal(ui.sent[0].externalOk, true);
  assert.equal(ui.control('rightsOk').checked, false); assert.equal(ui.control('externalOk').checked, false);
  ui.complete(success); await pending;
  assert.equal(ui.control('rightsOk').checked, false); assert.equal(ui.control('externalOk').checked, false);
  const retry = ui.draft.emit('submit');
  assert.equal(ui.sent[1].rightsOk, false); assert.equal(ui.sent[1].externalOk, false);
  ui.complete(false); await retry;
});
