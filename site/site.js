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
  // LOCAL_WORKSPACE_JS_START
  // Only render workstation shortcuts when the local Node server serves /site/.
  // Static public hosting never receives a route to the Treasury admin tool.
  const isLocalSite = ['127.0.0.1', 'localhost'].includes(location.hostname) &&
    (location.pathname === '/site' || location.pathname.startsWith('/site/'));
  if (isLocalSite) {
    for (const element of document.querySelectorAll('[data-local-only]')) element.hidden = false;
  }
  // LOCAL_WORKSPACE_JS_END
  const copy = document.querySelector('[data-copy-mint]');
  const status = document.getElementById('copyStatus');
  if (copy && status) copy.addEventListener('click', async () => {
    const value = document.getElementById('mintValue')?.textContent?.trim();
    if (!value) return;
    try { await navigator.clipboard.writeText(value); status.textContent = 'Devnet 주소를 복사했습니다.'; }
    catch { status.textContent = '복사 실패. 주소를 직접 선택하세요.'; }
  });
})();
