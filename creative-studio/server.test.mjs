import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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
  const server = http.createServer(createHandler({ mode: 'demo', ...opts }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}

async function post(base, path, body, headers = {}) {
  return fetch(base + path, { method: 'POST', headers: {
    'content-type': 'application/json', 'x-studio-request': '1', ...headers,
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
