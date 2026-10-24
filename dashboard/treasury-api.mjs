import { readFile } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TreasuryStore, IDS } from './treasury-store.mjs';
let defaultStore;
export function defaultTreasuryStore() {
  if (!defaultStore) defaultStore = (async () => {
    if (!process.env.TREASURY_CONFIG) return null;
    const config = JSON.parse(await readFile(process.env.TREASURY_CONFIG, 'utf8'));
    const store = await TreasuryStore.open({ config, path: join(dirname(fileURLToPath(import.meta.url)), '.treasury-data', 'events.jsonl') });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await store.close(); process.exit(0); });
    process.once('exit', () => { if (store.lock) { try { unlinkSync(store.path + '.lock'); } catch {} } });
    return store;
  })();
  return defaultStore;
}
function fail(message, status) { throw Object.assign(Error(message), { status }); }
export async function treasuryAPI(req, res, getStore = defaultTreasuryStore) {
  // Reject rebinding / cross-origin writes; never expose this local service via a proxy.
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(host)) fail('로컬 Host만 허용합니다.', 403);
  const url = new URL(req.url, 'http://' + host);
  const json = (status, data) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(data));
  };
  if (!['GET', 'POST'].includes(req.method)) return json(405, { error: 'GET / POST only' });
  if (req.method === 'POST' && (req.headers.origin !== 'http://' + host || req.headers['content-type']?.split(';')[0].trim() !== 'application/json')) fail('동일 출처 JSON 요청만 허용합니다.', 403);
  const store = await getStore();
  if (req.method === 'GET' && url.pathname === '/api/treasury') return json(200, store ? store.snapshot() : {
    enabled: false, network: 'devnet', executionEnabled: false, onchainMultisigVerified: false, requests: [], events: [],
    message: '공개 주소 설정 전입니다. TREASURY_CONFIG 설정 후 서버를 다시 시작하세요.' });
  if (!store) fail('Treasury 공개 주소 설정이 필요합니다.', 409);
  if (req.method === 'GET' && url.pathname === '/api/treasury/message') {
    const params = url.searchParams;
    const required = ['id', 'revision', 'signer', 'decision'];
    if ([...params.keys()].length !== 4 || required.some(k => params.getAll(k).length !== 1) || !/^[1-9][0-9]{0,5}$/.test(params.get('revision'))) fail('서명 요청 형식 오류', 400);
    const id = params.get('id'), revision = Number(params.get('revision')), signer = params.get('signer'), decision = params.get('decision');
    if (!IDS.includes(signer)) fail('서명자 오류', 400);
    return json(200, { message: store.message(id, revision, signer, decision), address: store.config.signers[signer], revision });
  }
  if (req.method === 'POST') {
    if (!['/api/treasury/requests', '/api/treasury/revise', '/api/treasury/decisions'].includes(url.pathname)) return json(404, { error: 'Not found' });
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 16384) fail('요청 크기 초과', 413); chunks.push(Buffer.from(chunk)); }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('JSON 형식 오류', 400); }
    if (url.pathname === '/api/treasury/requests') return json(201, await store.create(input));
    if (url.pathname === '/api/treasury/revise') {
      if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['id', 'revision', 'content'].includes(k))) fail('수정 요청 형식 오류', 400);
      return json(200, await store.revise(input.id, input.revision, input.content));
    }
    return json(200, await store.decide(input));
  }
  return json(404, { error: 'Not found' });
}
