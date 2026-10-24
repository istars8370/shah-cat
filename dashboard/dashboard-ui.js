// Presentation helpers only. Wallet requests and Devnet validation stay in wallet.js.
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const content = node => (node?.textContent || "").replace(/\s+/g, " ").trim();
  const { PROJECT, NETWORK, TOKEN } = ShahCat;
  for (const [attribute, value] of [
    ["data-project-name", PROJECT.name], ["data-project-tagline", PROJECT.tagline],
    ["data-network-label", NETWORK.label], ["data-token-name", TOKEN.name],
    ["data-token-symbol", TOKEN.symbol],
  ]) {
    for (const node of document.querySelectorAll("[" + attribute + "]")) node.textContent = value;
  }
  document.title = PROJECT.name + " | " + NETWORK.label + " Dashboard";
  for (const node of document.querySelectorAll("img[data-project-logo]")) node.src = PROJECT.logoUrl;
  if ($("projectFavicon")) $("projectFavicon").href = PROJECT.logoUrl;
  if ($("treasuryRole")) $("treasuryRole").textContent = ShahCat.OWNERS[1].role;
  const hasShahHistory = TOKEN.mint === "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
  for (const node of document.querySelectorAll("[data-shah-history]")) node.hidden = !hasShahHistory;
  if (!hasShahHistory && $("metadataHistoryNote")) {
    $("metadataHistoryNote").textContent = "현재 토큰의 메타데이터 점검 기록이 없습니다.";
  }
  if ($("amountPrecision")) $("amountPrecision").textContent = "소수점 " + TOKEN.decimals + "자리까지";
  if ($("tokenDecimals")) $("tokenDecimals").textContent = TOKEN.decimals + " decimals";
  if ($("mintExplorer")) $("mintExplorer").href = NETWORK.explorerUrl + "/address/" +
    encodeURIComponent(TOKEN.mint) + "?cluster=" + encodeURIComponent(NETWORK.explorerCluster);

  function observeText(id, render) {
    const node = $(id);
    if (!node) return;
    render(content(node));
    new MutationObserver(() => render(content(node))).observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function showStatus(node, text, state, detail = "") {
    if (!node) return;
    node.textContent = text;
    node.dataset.state = state;
    node.title = detail;
  }

  function firstSentence(message) {
    const text = message.replace(/^⚠\s*/, "");
    // A decimal point in a fee or amount is not a sentence boundary.
    return text.match(/^.*?[.!?。](?=\s|$)/)?.[0] || text;
  }

  const validationSteps = [
    { source: "sendMessage", output: "inputStatus", passed: /^✓ 입력 검증 통과/, label: "입력 검증 통과" },
    { source: "preflightMessage", output: "preflightStatus", passed: /^✓ Devnet 읽기 전용 사전 점검 통과/, label: "온체인 점검 통과" },
    { source: "quoteMessage", output: "quoteStatus", passed: /^✓ 서명 없는 Devnet 시뮬레이션 통과/, label: "서명 없는 시뮬레이션 통과" },
  ];

  for (const step of validationSteps) {
    const output = $(step.output);
    if (!output) continue;
    output.setAttribute("aria-live", "polite");
    output.setAttribute("aria-atomic", "true");
    observeText(step.source, message => {
      // Keep an actionable error visible even when its advice says "다시".
      if (/^⚠|실패|먼저 통과해야/.test(message)) {
        showStatus(output, firstSentence(message), "warning", message);
      } else if (/무효화|다시|변경/.test(message)) {
        showStatus(output, "다시 확인", "idle", message);
      } else if (step.passed.test(message)) {
        showStatus(output, step.label, "success", message);
      } else if (/(?:조회|확인|점검)\s*중(?:\.|…|$)/.test(message)) {
        showStatus(output, "확인 중…", "pending", message);
      } else {
        showStatus(output, "대기", "idle", message);
      }
    });
  }

  observeText("message", message => {
    const indicator = $("statusIndicator");
    if (/^⚠|실패/.test(message)) {
      showStatus(indicator, "조회 확인 필요", "warning", message);
    } else if (/^✓ Devnet 조회 성공/.test(message)) {
      showStatus(indicator, "조회 완료", "success", message);
    } else if (/(?:조회|확인)\s*중(?:\.|…|$)/.test(message)) {
      showStatus(indicator, "조회 중", "pending", message);
    } else {
      showStatus(indicator, "조회 대기", "idle", message);
    }
  });

  observeText("walletAddress", address => {
    const connected = ShahCat.isPublicKey(address);
    showStatus($("walletState"), connected ? "연결됨" : "연결 전", connected ? "success" : "idle");
    if ($("copyWallet")) $("copyWallet").disabled = !connected;
  });

  async function copyAddress(address, label) {
    const message = $("copyMessage");
    if (!ShahCat.isPublicKey(address)) {
      showStatus(message, "복사할 주소가 없습니다. 지갑 연결 상태를 확인해 주세요.", "warning");
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      showStatus(message, "주소 복사를 요청했습니다. 브라우저 알림을 확인해 주세요.", "pending");
      await navigator.clipboard.writeText(address);
      showStatus(message, label + " 전체 주소를 복사했습니다.", "success");
    } catch (_) {
      showStatus(message, "복사하지 못했습니다. 주소를 직접 선택해 주세요.", "warning");
    }
  }

  $("copyWallet")?.addEventListener("click", () => copyAddress(content($("walletAddress")), "지갑"));
  $("copyMint")?.addEventListener("click", () => copyAddress(ShahCat.MINT, "Mint"));

  const sectionIds = new Set(["overview", "walletSection", "transferSection", "activitySection", "projectSection"]);
  const links = [...document.querySelectorAll(".nav-link[href^='#']")]
    .map(link => ({ link, section: $(link.getAttribute("href").slice(1)) }))
    .filter(item => item.section && sectionIds.has(item.section.id));

  function setCurrent(sectionId) {
    for (const { link, section } of links) {
      if (section.id === sectionId) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }

  if (links.length) {
    const selected = links.find(({ section }) => "#" + section.id === location.hash) || links[0];
    let preferredSectionId = selected.section.id;
    setCurrent(selected.section.id);
    for (const { link, section } of links) {
      link.addEventListener("click", () => {
        preferredSectionId = section.id;
        setCurrent(section.id);
      });
    }
    window.addEventListener("hashchange", () => {
      const match = links.find(({ section }) => "#" + section.id === location.hash);
      if (match) {
        preferredSectionId = match.section.id;
        setCurrent(match.section.id);
      }
    });

    if ("IntersectionObserver" in window) {
      const visible = new Set();
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        // Side-by-side sections can share a top edge; retain the user's choice
        // while it remains in the observation band instead of breaking the tie.
        const candidates = [...visible];
        const current = candidates.find(section => section.id === preferredSectionId) ||
          candidates.sort((a, b) =>
            Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top)
          )[0];
        if (current) setCurrent(current.id);
      }, { rootMargin: "-10% 0px -60% 0px", threshold: 0 });
      for (const { section } of links) observer.observe(section);
    }
  }
})();
