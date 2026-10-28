const $ = id => document.getElementById(id);
const draftForm = $('draft-form');
const quoteForm = $('quote-form');
let mode = 'demo';

async function jsonRequest(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-studio-request': '1' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || '요청 실패');
  return data;
}

fetch('/api/config').then(r => r.json()).then(config => {
  mode = config.mode;
  $('mode').textContent = mode === 'openai' ? 'AI 연결 · 사람 검수 필수' : 'DEMO · AI 미연결';
  $('external-consent').hidden = mode !== 'openai';
}).catch(() => { $('mode').textContent = '연결 확인 실패'; });

draftForm.addEventListener('submit', async event => {
  event.preventDefault();
  const f = new FormData(draftForm);
  const payload = { kind: f.get('kind'), platform: f.get('platform'), tone: f.get('tone'),
    brief: f.get('brief'), rightsOk: f.get('rightsOk') === 'on', externalOk: f.get('externalOk') === 'on' };
  $('generate').disabled = true;
  $('draft-output').textContent = '초안 준비 중...';
  try {
    const result = await jsonRequest('/api/draft', payload);
    $('draft-output').textContent = result.content + '\n\n' + result.note;
  } catch (e) { $('draft-output').textContent = '실행 실패: ' + e.message; }
  finally { $('generate').disabled = false; }
});

$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('draft-output').textContent); $('copy').textContent = '복사됨'; }
  catch { $('copy').textContent = '직접 선택해 복사하세요'; }
});

quoteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const f = new FormData(quoteForm);
  const numeric = ['paid_krw', 'cash_cost_krw', 'labor_hours', 'labor_rate_krw', 'fee_krw', 'refund_krw'];
  const payload = Object.fromEntries(numeric.map(k => [k, Number(f.get(k))]));
  try {
    const result = await jsonRequest('/api/quote', payload);
    $('profit').textContent = result.contribution_krw.toLocaleString('ko-KR') + '원';
    $('profit').classList.toggle('negative', result.contribution_krw < 0);
    $('margin').textContent = `마진 ${result.margin_pct === null ? '계산 불가' : result.margin_pct + '%'} · ${result.note}`;
  } catch (e) {
    $('profit').textContent = '입력 확인'; $('margin').textContent = e.message;
  }
});
