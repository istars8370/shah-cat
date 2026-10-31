const $ = id => document.getElementById(id);
const draftForm = $('draft-form');
const quoteForm = $('quote-form');
const fields = ['post', 'hashtags', 'imagePrompt'];
const checks = ['edited', 'rights', 'facts', 'commercial', 'likeness'];
let record = null, dirty = false, busy = false;
async function jsonRequest(path, payload) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-studio-request': '1' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || '요청 실패');
  return data;
}
function message(text) { $('workflow-message').textContent = text; }
function clearBriefConsent() {
  for (const name of ['rightsOk', 'externalOk']) draftForm.elements.namedItem(name).checked = false;
}
function render(fill = false) {
  if (fill) {
    for (const key of fields) $(key).value = record?.content[key] || '';
    $('metadata').textContent = record ? JSON.stringify(record.content.metadata, null, 2) : '';
    $('approval-form').reset();
    for (const key of checks) $('approval-form').elements.namedItem(key).checked = record?.checks?.[key] === true;
  }
  $('workflow-state').textContent = record ? `${record.state} · v${record.revision}${dirty ? ' · 미저장 수정' : ''}` : '작업 없음';
  for (const control of draftForm.elements) control.disabled = busy;
  for (const key of fields) $(key).disabled = busy || !record;
  $('save').disabled = busy || !record || !dirty;
  $('review').disabled = busy || dirty || record?.state !== 'DRAFT';
  $('approve').disabled = busy || dirty || record?.state !== 'REVIEW_REQUIRED';
  for (const control of $('approval-form').elements) if (control.type === 'checkbox') control.disabled = busy || dirty || record?.state !== 'REVIEW_REQUIRED';
  for (const id of ['copy', 'export-md', 'export-json']) $(id).disabled = busy || dirty || !['APPROVED', 'EXPORTED'].includes(record?.state);
}
fetch('/api/config').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(config => {
  $('mode').textContent = config.mode === 'openai' ? 'AI 연결 · 요청별 과금 동의 필수' : 'DEMO · AI 미연결';
  $('external-consent').hidden = config.mode !== 'openai';
}).catch(() => { $('mode').textContent = '연결 확인 실패'; });
$('sample').addEventListener('click', () => {
  const sample = { brand: '구름문구 (가상)', industry: '문구 소품', purpose: '새 노트 소개', audience: '기록을 즐기는 성인', brief: '가상 문구 브랜드의 노트를 소개합니다. 실제 가격·성과·고객 후기·할인은 만들지 않습니다.' };
  for (const [key, value] of Object.entries(sample)) draftForm.elements.namedItem(key).value = value;
  clearBriefConsent();
  record = null; dirty = false; render(true);
});
function briefChanged(event) {
  // Checking one confirmation must not clear the other confirmation.
  if (!['rightsOk', 'externalOk'].includes(event.target.name)) clearBriefConsent();
  record = null; dirty = false; render(true); message('브리프를 변경했습니다. 새 초안을 생성하세요.');
}
draftForm.addEventListener('input', briefChanged);
draftForm.addEventListener('change', briefChanged);
draftForm.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const f = new FormData(draftForm);
  const payload = Object.fromEntries(['brand', 'industry', 'purpose', 'audience', 'channel', 'length', 'kind', 'tone', 'brief'].map(k => [k, f.get(k)]));
  payload.rightsOk = f.get('rightsOk') === 'on'; payload.externalOk = f.get('externalOk') === 'on';
  // Consume the captured confirmations before awaiting even a failed provider request.
  clearBriefConsent();
  record = null; dirty = false; busy = true; render(true); message('초안 준비 중...');
  try {
    record = await jsonRequest('/api/workflow', payload);
    message('초안을 읽고 수정한 다음 검수를 요청하세요. 자동 게시되지 않습니다.');
  } catch (e) { message('실행 실패: ' + e.message); }
  finally { clearBriefConsent(); busy = false; render(true); }
});
for (const key of fields) $(key).addEventListener('input', () => {
  dirty = true; $('approval-form').reset(); render(); message('수정 저장 후 검수와 승인을 다시 진행하세요.');
});
async function action(actionName, extra = {}) {
  if (busy || !record || (dirty && actionName !== 'edit')) return null;
  busy = true; render();
  try {
    const result = await jsonRequest('/api/workflow/action', { id: record.id, revision: record.revision, action: actionName, ...extra });
    record = result; dirty = false; render(true);
    message(actionName === 'export' ? '내보내기 준비 완료 · 플랫폼 게시/전송 없음' : `현재 상태: ${record.state}`);
    return result;
  } catch (e) {
    // A lost response may have committed a transition; discard stale approval locally.
    record = null; dirty = false; render(true);
    message('작업 실패: ' + e.message + ' 새 초안을 만들어 다시 검수하세요.'); return null;
  } finally { busy = false; render(); }
}
$('save').addEventListener('click', () => action('edit', { content: Object.fromEntries(fields.map(k => [k, $(k).value])) }));
$('review').addEventListener('click', () => action('review'));
$('approval-form').addEventListener('submit', event => {
  event.preventDefault(); const form = new FormData($('approval-form'));
  if (checks.some(k => form.get(k) !== 'on')) { message('다섯 항목을 모두 확인해야 승인할 수 있습니다.'); return; }
  action('approve', { checks: Object.fromEntries(checks.map(k => [k, true])) });
});
$('copy').addEventListener('click', async () => {
  const result = await action('export', { format: 'markdown' }); if (!result) return;
  try { await navigator.clipboard.writeText(result.output); message('승인본 복사 완료 · 게시/전송 없음'); }
  catch { message('클립보드 권한이 없습니다. Markdown/JSON 내보내기를 사용하세요.'); }
});
for (const [id, format, extension] of [['export-md', 'markdown', 'md'], ['export-json', 'json', 'json']]) {
  $(id).addEventListener('click', async () => {
    const result = await action('export', { format }); if (!result) return;
    const url = URL.createObjectURL(new Blob([result.output], { type: format === 'json' ? 'application/json' : 'text/markdown' }));
    const link = document.createElement('a'); link.href = url; link.download = `creative-studio-v${result.revision}.${extension}`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
quoteForm.addEventListener('submit', async event => {
  event.preventDefault(); const f = new FormData(quoteForm);
  const numeric = ['paid_krw', 'cash_cost_krw', 'ai_cost_krw', 'revision_cost_krw', 'labor_hours', 'labor_rate_krw', 'fee_krw', 'refund_krw'];
  const payload = Object.fromEntries(numeric.map(k => [k, f.get(k)?.trim() ? Number(f.get(k)) : null]));
  payload.revenue_source = f.get('revenue_source');
  try {
    const result = await jsonRequest('/api/quote', payload);
    $('profit').textContent = `${result.contribution_krw < 0 ? '적자 ' : ''}${result.contribution_krw.toLocaleString('ko-KR')}원`;
    $('profit').classList.toggle('negative', result.contribution_krw < 0);
    $('margin').textContent = `마진 ${result.margin_pct === null ? '계산 불가' : result.margin_pct + '%'} · ${result.note}`;
  } catch (e) { $('profit').textContent = '입력 확인'; $('margin').textContent = e.message; }
});
render();
