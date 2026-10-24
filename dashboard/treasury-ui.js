// Explicit message approval on a separate page; existing read-only wallet is unchanged.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ids = ['seongjae', 'dongwon', 'parkwon'];
  const names = { seongjae: '성재', dongwon: '동원', parkwon: '박원' };
  const states = { pending: '승인 대기', policy_approved: '정책 승인 완료 · 미집행', rejected: '반려', expired: '만료', budget_invalid: '예산 재확인 필요' };
  const kinds = { budget: '월 예산', spend: '일반 지출', exception: '특별 지출', reserve: '예비금' };
  let snapshot = null, selected = null, editing = null, provider = null, address = '', prepared = null, generation = 0, busy = false;
  const note = value => { $('treasuryMessage').textContent = value; };
  function invalidate() { ++generation; prepared = null; $('treasurySign').disabled = true; $('treasurySigningText').textContent = '내용 확인이 필요합니다.'; }
  function controls() {
    const p = snapshot?.requests?.find(x => x.id === selected);
    const signer = ids.find(id => snapshot?.config?.signers[id] === address);
    $('treasurySave').disabled = busy || !snapshot?.enabled;
    $('treasuryEdit').disabled = busy || !p || p.status !== 'pending';
    $('treasuryPrepare').disabled = busy || !p || p.status !== 'pending' || !p.eligible.includes(signer) || p.approvals.some(a => a.signer === signer);
    $('treasurySign').disabled = busy || !prepared;
    $('treasuryConnect').disabled = busy;
    $('treasuryRefresh').disabled = busy;
    $('treasuryExport').disabled = busy || !snapshot?.enabled;
  }
  async function api(path, body) {
    const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Treasury 요청 실패');
    return data;
  }
  async function action(fn) {
    if (busy) return;
    busy = true; controls();
    try { await fn(); } catch (error) { note(error.message || '처리 실패'); invalidate(); }
    finally { busy = false; controls(); }
  }
  function showDetail() {
    const p = snapshot?.requests.find(x => x.id === selected);
    $('treasuryDetail').textContent = p ? JSON.stringify(p, null, 2) : '요청을 선택하세요.';
    controls();
  }
  async function refresh() {
    invalidate();
    snapshot = null; controls(); $('treasuryCustody').textContent = 'Treasury 보관 역할을 다시 확인하고 있습니다.';
    const data = await api('/api/treasury');
    if (data.network !== 'devnet' || data.executionEnabled !== false || data.onchainMultisigVerified !== false || !Array.isArray(data.requests)) throw Error('Treasury 응답의 네트워크 또는 실행 상태 불일치');
    snapshot = data;
    const custodians = data.enabled ? ids.filter(id => data.config.signers[id] === data.config.treasury) : [];
    $('treasuryCustody').textContent = !data.enabled ? '운영 주소 미설정' : custodians.length
      ? custodians.map(id => names[id]).join(', ') + ' 승인자 주소를 Treasury로 함께 사용합니다. 정책 승인 2인 요건은 실제 자금 이동을 강제하지 않으며, 온체인 다중서명은 미검증입니다.'
      : 'Treasury 주소와 승인자 주소가 구분되어 있습니다. 주소 분리만으로 온체인 다중서명이 검증되는 것은 아닙니다.';
    $('treasuryConfig').textContent = data.enabled ? JSON.stringify({ ...data.config, ledgerId: data.ledgerId, configHash: data.configHash }, null, 2) : data.message;
    $('treasuryRequests').replaceChildren();
    const priorBudget = $('treasuryBudget').value;
    $('treasuryBudget').replaceChildren();
    const option = (value, label) => { const n = document.createElement('option'); n.value = value; n.textContent = label; $('treasuryBudget').append(n); };
    option('', '예산 선택');
    for (const p of data.requests) {
      if (p.content.kind === 'budget' && p.status === 'policy_approved') option(p.id, p.content.purpose + ' / ' + p.id);
      const row = document.createElement('tr');
      for (const value of [kinds[p.content.kind] + ' · ' + p.content.purpose + '\n' + p.id + ' / v' + p.revision,
        ShahCat.format(ShahCat.amount(p.content.amountRaw)) + ' SHAH', (states[p.status] || p.status) + ' · ' + p.approvals.length + '/' + p.required]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      const cell = document.createElement('td'), button = document.createElement('button');
      button.type = 'button'; button.className = 'button'; button.textContent = '검토';
      button.addEventListener('click', () => { if (busy) return; selected = p.id; invalidate(); showDetail(); });
      cell.append(button); row.append(cell); $('treasuryRequests').append(row);
    }
    $('treasuryBudget').value = priorBudget;
    if (!data.requests.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = '등록된 요청이 없습니다.'; row.append(cell); $('treasuryRequests').append(row); }
    showDetail(); note(data.enabled ? '정책 승인 원장을 불러왔습니다. 온체인 집행은 연결되지 않았습니다.' : data.message);
  }
  function formContent() {
    const kind = $('treasuryKind').value;
    const quantity = value => String(ShahCat.parseAmount(value, 9));
    return { kind, purpose: $('treasuryPurpose').value.trim(), evidence: $('treasuryEvidence').value.trim(),
      amountRaw: quantity($('treasuryAmount').value), feeCapLamports: quantity($('treasuryFee').value),
      startsAt: $('treasuryStart').value + 'T00:00:00.000Z', expiresAt: $('treasuryEnd').value + 'T00:00:00.000Z',
      recipient: kind === 'budget' ? null : $('treasuryRecipient').value.trim(),
      conflicts: ids.filter(id => $('conflict-' + id).checked), budgetId: kind === 'spend' ? $('treasuryBudget').value : null };
  }
  function resetEdit() { editing = null; $('treasurySave').textContent = '새 요청 등록'; $('treasuryEditNote').textContent = '새 요청 작성 중입니다. 수정 시 기존 승인은 무효화됩니다.'; }
  $('treasuryForm').addEventListener('submit', event => { event.preventDefault(); return action(async () => {
    invalidate(); const content = formContent();
    const p = editing ? await api('/api/treasury/revise', { ...editing, content }) : await api('/api/treasury/requests', content);
    selected = p.id; resetEdit(); await refresh();
  }); });
  $('treasuryReset').addEventListener('click', () => { if (!busy) resetEdit(); });
  $('treasuryEdit').addEventListener('click', () => {
    if (busy) return;
    const p = snapshot?.requests.find(x => x.id === selected); if (!p || p.status !== 'pending') return;
    invalidate(); editing = { id: p.id, revision: p.revision };
    const c = p.content;
    for (const [id, value] of [['Kind', c.kind], ['Budget', c.budgetId || ''], ['Purpose', c.purpose], ['Evidence', c.evidence],
      ['Amount', ShahCat.amount(c.amountRaw)], ['Fee', ShahCat.amount(c.feeCapLamports)], ['Start', c.startsAt.slice(0,10)], ['End', c.expiresAt.slice(0,10)], ['Recipient', c.recipient || '']]) $('treasury' + id).value = value;
    ids.forEach(id => { $('conflict-' + id).checked = c.conflicts.includes(id); });
    $('treasurySave').textContent = '새 버전 저장 · 기존 승인 무효'; $('treasuryEditNote').textContent = p.id + ' / v' + p.revision + ' 수정 중';
  });
  $('treasuryRefresh').addEventListener('click', () => action(refresh));
  $('treasuryDecision').addEventListener('change', () => { invalidate(); controls(); });
  $('treasuryConnect').addEventListener('click', () => action(async () => {
    invalidate();
    const candidate = window.phantom?.solana || window.solana;
    if (candidate?.isPhantom !== true || typeof candidate.signMessage !== 'function') throw Error('메시지 서명을 지원하는 Phantom 브라우저 확장이 필요합니다.');
    const result = await candidate.connect();
    const nextAddress = result?.publicKey?.toBase58?.();
    if (!ShahCat.isPublicKey(nextAddress)) throw Error('지갑 공개 주소를 확인하지 못했습니다.');
    if (provider !== candidate) {
      provider?.removeListener?.('accountChanged', walletChanged); provider?.removeListener?.('disconnect', walletDisconnected);
      provider = candidate; provider.on?.('accountChanged', walletChanged); provider.on?.('disconnect', walletDisconnected);
    }
    address = nextAddress; walletText();
    note(ids.some(id => snapshot?.config?.signers[id] === address) ? '등록 서명자 지갑을 연결했습니다.' : '연결 주소가 등록 서명자에 없습니다.');
  }));
  function walletText() { $('treasuryWallet').textContent = address ? (names[ids.find(id => snapshot?.config?.signers[id] === address)] || '미등록 지갑') + ' · ' + address : '지갑 미연결'; controls(); }
  function walletChanged(key) { invalidate(); address = key?.toBase58?.() || ''; walletText(); }
  function walletDisconnected() { walletChanged(null); }
  $('treasuryPrepare').addEventListener('click', () => action(async () => {
    invalidate(); const version = generation, p = snapshot.requests.find(x => x.id === selected);
    const signer = ids.find(id => snapshot.config.signers[id] === address), decision = $('treasuryDecision').value;
    if (!p || !signer) throw Error('요청과 등록 지갑을 선택하세요.');
    const data = await api('/api/treasury/message?' + new URLSearchParams({ id: p.id, revision: String(p.revision), signer, decision }));
    if (version !== generation) return;
    const prefix = 'SHAH CAT Treasury policy decision v1\nNOT A TRANSACTION. DEVNET ONLY.\n';
    if (typeof data.message !== 'string' || !data.message.startsWith(prefix) || data.address !== address) throw Error('서명할 메시지의 주소 또는 형식 불일치');
    const payload = JSON.parse(data.message.slice(prefix.length));
    if (payload.ledgerId !== snapshot.ledgerId || payload.configHash !== snapshot.configHash || payload.requestId !== p.id || payload.revision !== p.revision || payload.signer !== signer || payload.decision !== decision || payload.address !== address || JSON.stringify(payload.content) !== JSON.stringify(p.content) || payload.nonce !== p.nonce || payload.budgetRevision !== p.budgetRevision || payload.policyVersion !== '0.5' || payload.display?.amountSHAH !== ShahCat.amount(p.content.amountRaw) || payload.display?.feeCapSOL !== ShahCat.solAmount(p.content.feeCapLamports)) throw Error('요청과 서명 메시지가 다릅니다. 새로고침하세요.');
    prepared = { message: data.message, id: p.id, revision: p.revision, signer, decision, address, generation: version };
    $('treasurySigningText').textContent = data.message; note('금액·수령 주소·수수료·결정을 확인한 뒤 서명하세요.');
  }));
  $('treasurySign').addEventListener('click', () => action(async () => {
    const entry = prepared;
    if (!entry || entry.generation !== generation || provider?.publicKey?.toBase58?.() !== entry.address) throw Error('지갑 또는 승인 내용이 변경됐습니다.');
    const result = await provider.signMessage(new TextEncoder().encode(entry.message), 'utf8');
    if (entry.generation !== generation || provider.publicKey?.toBase58?.() !== entry.address) throw Error('서명 중 지갑 또는 요청이 변경됐습니다.');
    if (!(result?.signature instanceof Uint8Array) || result.signature.length !== 64 || result.publicKey?.toBase58?.() !== entry.address) throw Error('지갑 서명 응답을 확인하지 못했습니다.');
    const signature = btoa(Array.from(result.signature, b => String.fromCharCode(b)).join(''));
    await api('/api/treasury/decisions', { id: entry.id, revision: entry.revision, signer: entry.signer, decision: entry.decision, signature });
    await refresh();
  }));
  $('treasuryExport').addEventListener('click', () => {
    if (!snapshot?.enabled || busy) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'SHAH_CAT_Treasury_Policy_Ledger.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1));
  $('treasuryStart').value = start.toISOString().slice(0,10); $('treasuryEnd').value = end.toISOString().slice(0,10);
  action(refresh);
})();
