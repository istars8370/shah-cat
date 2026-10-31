(() => {
  'use strict';
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('siteNav');
  if (menu && nav) {
    const close = () => { nav.classList.remove('is-open'); menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','메뉴 열기'); };
    menu.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open',open);
      menu.setAttribute('aria-expanded',String(open));
      menu.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
    });
    nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }
  const isLocal = ['127.0.0.1','localhost'].includes(location.hostname) && !location.port.startsWith('0');
  const local = document.querySelector('[data-local-only]');
  if (local && isLocal && location.pathname.startsWith('/site')) local.hidden = false;
  const copy = document.querySelector('[data-copy-mint]');
  const status = document.getElementById('copyStatus');
  if (copy && status) copy.addEventListener('click', async () => {
    const value = document.getElementById('mintValue')?.textContent?.trim();
    if (!value) return;
    try { await navigator.clipboard.writeText(value); status.textContent = 'Devnet 주소를 복사했습니다.'; }
    catch { status.textContent = '복사 실패. 주소를 직접 선택하세요.'; }
  });
})();
