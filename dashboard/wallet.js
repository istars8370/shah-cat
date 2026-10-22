// SHAH CAT Devnet wallet connection. No secret keys or transaction signing.
(() => {
  "use strict";
  const { MINT, DECIMALS, TOKEN, NETWORK, isPublicKey, rawAmount, parseAmount, amount, solAmount, format } = ShahCat;
  const $ = id => document.getElementById(id);
  const registry = ShahCatWallets.createRegistry();
  const pendingWallets = new Set();
  let walletOptions = [];
  let activeWallet = null;
  let walletAccounts = [];
  let stopWalletEvents = null;
  let connectionRequestId = 0;
  let connecting = false;
  let releasingWallets = 0;
  let connected = null;
  let balanceRaw = null;
  let solLamports = null;
  let balanceCheckedAt = null;
  let balanceRequestId = 0;
  let preflightRequestId = 0;
  let quoteRequestId = 0;
  const invalidateSend = () => {
    ++preflightRequestId;
    ++quoteRequestId;
    $("checkQuote").disabled = false;
    $("quoteMessage").textContent = "이전 수수료·시뮬레이션 결과가 무효화됐습니다. 다시 검사하세요.";
    $("checkPreflight").disabled = false;
    $("preflightMessage").textContent = "사전 점검 결과가 무효화됐습니다. 다시 점검하세요.";
    $("sendPreview").textContent = "입력 또는 잔액이 변경되었습니다. 다시 검증하세요.";
    $("sendMessage").textContent = "입력 또는 잔액이 변경되면 다시 검증하세요. 실제 전송은 비활성화되어 있습니다.";
  };
  const resetBalance = (message = "지갑 연결 후 Devnet 잔액을 확인하세요.") => {
    ++balanceRequestId;
    balanceRaw = null;
    solLamports = null;
    balanceCheckedAt = null;
    $("connectedSol").textContent = "—";
    $("connectedShah").textContent = "—";
    $("walletBalanceMessage").textContent = message;
    $("reloadWalletBalance").disabled = false;
    invalidateSend();
  };
  async function refreshBalance() {
    if (!connected) { resetBalance(); return; }
    const address = connected;
    resetBalance("Devnet 잔액 조회 중...");
    const requestId = balanceRequestId;
    const isCurrentRequest = () => requestId === balanceRequestId && connected === address;
    const btn = $("reloadWalletBalance");
    btn.disabled = true;
    try {
      const response = await fetch("/api/wallet?address=" + encodeURIComponent(address), {cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "조회 실패");
      if (!isCurrentRequest()) return;
      if (data.network !== NETWORK.cluster || data.mint !== MINT || data.decimals !== DECIMALS || data.address !== address) {
        throw Error("네트워크, Mint 또는 조회 주소가 일치하지 않습니다.");
      }
      const checkedAt = Date.parse(data.checkedAt);
      if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > 60000 || checkedAt - Date.now() > 5000) throw Error("잔액 조회 시각이 유효하지 않습니다.");
      balanceRaw = rawAmount(data.shahRaw);
      solLamports = rawAmount(data.solLamports);
      balanceCheckedAt = checkedAt;
      $("connectedSol").textContent = format(solAmount(solLamports));
      $("connectedShah").textContent = format(amount(balanceRaw));
      $("walletBalanceMessage").textContent = "✓ Devnet 잔액 확인 완료 (" + new Date(data.checkedAt).toLocaleTimeString("ko-KR") + ")";
    } catch(e) {
      if (!isCurrentRequest()) return;
      resetBalance("⚠ 잔액 조회 실패: " + e.message);
    } finally {if (isCurrentRequest()) btn.disabled = false;}
  }
  function validateSend() {
    const to = $("sendTo").value.trim();
    const value = $("sendAmount").value.trim();
    const out = $("sendMessage");
    $("sendPreview").textContent = "검증 실패 · 입력과 지갑 상태를 확인하세요.";
    if (!connected) {out.textContent="⚠ 먼저 지갑을 연결하세요.";return;}
    if (balanceRaw === null) {out.textContent="⚠ 먼저 지갑 잔액을 조회하세요.";return;}
    if (Date.now() - balanceCheckedAt > 60000) { resetBalance("잔액 조회 후 60초가 지났습니다. 다시 조회하세요."); out.textContent="⚠ 최신 지갑 잔액을 다시 조회하세요."; return; }
    if (!isPublicKey(to)) {out.textContent="⚠ 수신 주소 형식이 올바르지 않습니다.";return;}
    if (to === connected) {out.textContent="⚠ 자기 자신에게 보내는 전송은 테스트에서 제외합니다.";return;}
    let raw;
    try { raw = parseAmount(value); } catch (_) {out.textContent="⚠ 수량은 소수점 " + DECIMALS + "자리 이하이며 토큰 허용 범위 이내여야 합니다.";return;}
    if (raw <= 0n) {out.textContent="⚠ 0 " + TOKEN.symbol + "는 전송할 수 없습니다.";return;}
    if (raw > balanceRaw) {out.textContent="⚠ " + TOKEN.symbol + " 잔액이 부족합니다.";return;}
    if (solLamports < 10000000n) {out.textContent="⚠ 미리보기 기준으로 Devnet SOL 0.01 이상을 준비하세요. 실제 수수료 견적은 아닙니다.";return;}
    $("sendPreview").textContent = "Devnet 전송 미리보기 | Mint: " + MINT + " | 발신: " + connected + " | 수신: " + to + " | 수량: " + amount(raw) + " " + TOKEN.symbol + " | 실제 서명: 비활성";
    out.textContent="✓ 입력 검증 통과. " + value + " " + TOKEN.symbol + " → " + to + ". 실제 전송 및 서명은 아직 실행되지 않습니다.";
    return true;
  }

  async function checkPreflight() {
    if (!validateSend()) {
      $("preflightMessage").textContent = "입력 검증을 먼저 통과해야 합니다.";
      return;
    }
    const sender = connected;
    const recipient = $("sendTo").value.trim();
    const quantity = $("sendAmount").value.trim();
    const requestId = ++preflightRequestId;
    const isCurrent = () => requestId === preflightRequestId && connected === sender &&
      $("sendTo").value.trim() === recipient && $("sendAmount").value.trim() === quantity;
    $("checkPreflight").disabled = true;
    $("preflightMessage").textContent = "Devnet 온체인 계정 상태 확인 중...";
    try {
      const params = new URLSearchParams({ sender, recipient, amount: quantity });
      const response = await fetch("/api/preflight?" + params.toString(), { cache: "no-store" });
      const result = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw Error(result.error || "사전 점검 실패");
      if (result.network !== NETWORK.cluster || result.mint !== MINT || result.decimals !== DECIMALS ||
          result.sender !== sender || result.recipient !== recipient ||
          result.rawAmount !== String(parseAmount(quantity)) ||
          result.eligibleForConstruction !== true ||
          result.signatureEnabled !== false || result.broadcastingEnabled !== false) {
        throw Error("사전 점검 결과 불일치");
      }
      const checkedAt = Date.parse(result.checkedAt);
      if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > 30000 ||
          checkedAt - Date.now() > 5000) throw Error("오래되거나 잘못된 점검 결과");
      $("preflightMessage").textContent = "✓ Devnet 읽기 전용 사전 점검 통과 (소스 토큰 계정: " +
        result.sourceTokenAccount + "). 수신 ATA·실제 수수료·서명·전송은 검증/실행하지 않았습니다.";
    } catch (e) {
      if (isCurrent()) $("preflightMessage").textContent = "⚠ Devnet 사전 점검 실패: " + e.message;
    } finally {
      if (isCurrent()) $("checkPreflight").disabled = false;
    }
  }

  async function checkQuote() {
    if (!validateSend()) {
      $("quoteMessage").textContent = "⚠ 입력 검증을 먼저 통과해야 합니다.";
      return;
    }
    const sender = connected;
    const recipient = $("sendTo").value.trim();
    const quantity = $("sendAmount").value.trim();
    const requestId = ++quoteRequestId;
    const isCurrent = () => requestId === quoteRequestId && connected === sender &&
      $("sendTo").value.trim() === recipient && $("sendAmount").value.trim() === quantity;
    $("checkQuote").disabled = true;
    $("quoteMessage").textContent = "Devnet ATA·실제 메시지 수수료·서명 없는 RPC 시뮬레이션 조회 중...";
    try {
      const params = new URLSearchParams({ sender, recipient, amount: quantity });
      const response = await fetch("/api/quote?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw Error(data.error || "수수료·시뮬레이션 조회 실패");
      const feeLamports = rawAmount(data.feeLamports);
      const rentLamports = rawAmount(data.rentLamports);
      const checkedAt = Date.parse(data.checkedAt);
      if (data.network !== NETWORK.cluster || data.mint !== MINT || data.decimals !== DECIMALS ||
          data.sender !== sender || data.recipient !== recipient ||
          data.rawAmount !== String(parseAmount(quantity)) ||
          !isPublicKey(data.recipientAta) || !isPublicKey(data.sourceTokenAccount) ||
          data.simulationPassed !== true || data.signatureEnabled !== false ||
          data.broadcastingEnabled !== false ||
          !Number.isFinite(checkedAt) || Date.now() - checkedAt > 30000 ||
          checkedAt - Date.now() > 5000 ||
          typeof data.recipientAtaExists !== "boolean" ||
          data.requiresAtaCreation !== !data.recipientAtaExists ||
          data.totalPlannedSolLamports !== String(feeLamports + rentLamports)) {
        throw Error("RPC 견적 내용 또는 조회 시각이 일치하지 않습니다");
      }
      $("quoteMessage").textContent = "✓ 서명 없는 Devnet 시뮬레이션 통과 | 수신 ATA: " +
        data.recipientAta + " (" + (data.recipientAtaExists ? "기존 계정" : "미생성, 생성 명령 시뮬레이션 포함") +
        ") | 실제 메시지 수수료: " + data.feeSol + " SOL | ATA 임대 예치금: " +
        data.rentSol + " SOL | 실제 전송·지갑 서명: 없음. 향후 거래 성공은 보장되지 않습니다.";
    } catch (e) {
      if (isCurrent()) $("quoteMessage").textContent = "⚠ Devnet 수수료·시뮬레이션 실패: " + e.message;
    } finally {
      if (isCurrent()) $("checkQuote").disabled = false;
    }
  }

  const say = (message, bad = false) => {
    $("walletMessage").textContent = message;
    $("walletMessage").className = bad ? "warn" : "muted";
  };
  function render() {
    $("walletAddress").textContent = connected || "연결 안 됨";
    $("connectWallet").hidden = !!connected;
    $("connectWallet").disabled = connecting || releasingWallets > 0 || !walletOptions.length || pendingWallets.has($("walletSelect").value);
    $("disconnectWallet").hidden = !connected && !connecting;
    $("disconnectWallet").textContent = connecting ? "연결 취소" : "연결 해제";
    $("walletExplorer").hidden = !connected;
    $("walletAccountField").hidden = walletAccounts.length < 2;
    $("walletAccountSelect").disabled = connecting || walletAccounts.length < 2;
    $("walletAccountSelect").replaceChildren();
    for (const account of walletAccounts) {
      const option = document.createElement("option");
      option.value = account.address;
      option.textContent = (account.label ? account.label + " · " : "") +
        account.address.slice(0, 6) + "…" + account.address.slice(-6);
      option.title = account.address;
      $("walletAccountSelect").append(option);
    }
    $("walletAccountSelect").value = connected || "";
    if (connected) $("walletExplorer").href =
      NETWORK.explorerUrl.replace(/\/$/, "") + "/address/" + encodeURIComponent(connected) +
        "?cluster=" + encodeURIComponent(NETWORK.explorerCluster);
  }

  function clearConnection() {
    ++connectionRequestId;
    const old = activeWallet;
    const wasConnecting = connecting;
    try { stopWalletEvents?.(); } catch (_) {}
    stopWalletEvents = null;
    activeWallet = null;
    connected = null;
    walletAccounts = [];
    connecting = false;
    resetBalance();
    render();
    return { old, wasConnecting };
  }

  async function releaseWallet(wallet) {
    if (!wallet) return false;
    // Standard and injected paths may be the same extension. While any disconnect
    // is in flight, do not authorize a new path that it could subsequently disconnect.
    ++releasingWallets;
    render();
    try { return await wallet.disconnect(); }
    catch (_) { return false; }
    finally { --releasingWallets; render(); }
  }

  function selectAccounts(accounts, message) {
    walletAccounts = accounts;
    connected = accounts.find(account => account.address === connected)?.address || accounts[0]?.address || null;
    resetBalance();
    render();
    say(message);
    if (connected) refreshBalance();
  }

  function updateWalletOptions() {
    const previous = $("walletSelect").value;
    walletOptions = registry.getWallets();
    $("walletSelect").replaceChildren();
    const labels = new Map();
    for (const wallet of walletOptions) {
      const option = document.createElement("option");
      option.value = wallet.id;
      const label = wallet.name + (wallet.kind === "standard" ? " · Wallet Standard" : " · 확장 연결");
      const count = (labels.get(label) || 0) + 1;
      labels.set(label, count);
      option.textContent = label + (count > 1 ? " (" + count + ")" : "");
      $("walletSelect").append(option);
    }
    if (!walletOptions.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "호환 지갑을 찾지 못했습니다";
      $("walletSelect").append(option);
    }
    $("walletSelect").value = walletOptions.some(wallet => wallet.id === previous) ? previous : (walletOptions[0]?.id || "");
    $("walletSelect").disabled = !walletOptions.length;
    if (activeWallet && !walletOptions.includes(activeWallet)) {
      clearConnection();
      say("선택한 지갑을 더 이상 사용할 수 없습니다. 지원 지갑을 다시 선택하세요.", true);
    } else if (!activeWallet) {
      say(walletOptions.length ? "감지된 지갑을 선택한 뒤 연결하세요. 공개 주소만 요청합니다." :
        "이 브라우저에서 호환 지갑을 찾지 못했습니다. 지갑 확장 프로그램 또는 지갑 앱의 브라우저에서 열어 주세요.");
    }
    render();
  }

  async function connect() {
    registry.refresh();
    const wallet = walletOptions.find(item => item.id === $("walletSelect").value);
    if (!wallet || connecting || releasingWallets > 0 || connected || pendingWallets.has(wallet.id)) return;
    const requestId = ++connectionRequestId;
    activeWallet = wallet;
    connecting = true;
    let eventAccounts = null;
    const isCurrent = () => requestId === connectionRequestId && activeWallet === wallet;
    resetBalance();
    pendingWallets.add(wallet.id);
    render();
    say(wallet.name + "에서 공개 주소 연결을 승인해 주세요.");
    try {
      stopWalletEvents = wallet.subscribe(change => {
        if (!isCurrent()) return;
        if (change.error || !change.accounts.length) {
          clearConnection();
          say(change.error || "지갑 연결이 해제됐습니다.", !!change.error);
        } else if (connecting) {
          eventAccounts = change.accounts;
        } else {
          selectAccounts(change.accounts, "지갑 계정 정보가 변경됐습니다. 주소와 Devnet 잔액을 다시 확인하세요.");
        }
      });
      const accounts = await wallet.connect();
      if (!isCurrent()) {
        // A cancelled popup may still resolve. Never restore its address or balances.
        // Do not disconnect another active path that could belong to the same extension.
        if (!activeWallet) {
          await releaseWallet(wallet);
        }
        return;
      }
      const selected = eventAccounts || accounts;
      if (!selected.length) throw Error("연결 가능한 Solana Devnet 계정을 받지 못했습니다.");
      connecting = false;
      selectAccounts(selected, wallet.connectionNote);
    } catch (e) {
      if (!isCurrent()) return;
      clearConnection();
      say(e?.code === 4001 || e?.name === "AbortError" ? "연결 요청을 취소했어요." :
        "연결 실패: " + (e?.message || "알 수 없는 오류"), true);
    } finally {
      pendingWallets.delete(wallet.id);
      if (isCurrent()) connecting = false;
      render();
    }
  }
  async function disconnect() {
    const { old, wasConnecting } = clearConnection();
    const requestId = connectionRequestId;
    if (wasConnecting) {
      say("연결 요청을 취소했습니다. 지갑 팝업이 열려 있다면 닫아 주세요.");
      return;
    }
    const released = await releaseWallet(old);
    if (requestId === connectionRequestId) say(released ? "지갑 연결을 해제했습니다." :
      "화면의 지갑 연결을 해제했습니다. 지갑 앱의 연결 권한은 지갑에서 관리하세요.");
  }
  $("connectWallet").addEventListener("click", connect);
  $("disconnectWallet").addEventListener("click", disconnect);
  $("walletSelect").addEventListener("change", () => {
    const { old, wasConnecting } = clearConnection();
    say("지갑 선택이 변경됐습니다. 선택한 지갑을 연결하세요.");
    if (old && !wasConnecting) void releaseWallet(old);
  });
  $("walletSelect").addEventListener("focus", () => registry.refresh());
  $("walletAccountSelect").addEventListener("change", () => {
    const account = walletAccounts.find(item => item.address === $("walletAccountSelect").value);
    if (!activeWallet || connecting || !account) return;
    connected = account.address;
    selectAccounts(walletAccounts, "표시할 계정을 변경했습니다. 주소와 Devnet 잔액을 확인하세요.");
  });
  $("reloadWalletBalance").addEventListener("click", refreshBalance);
  $("checkSend").addEventListener("click", validateSend);
  $("checkPreflight").addEventListener("click", checkPreflight);
  $("checkQuote").addEventListener("click", checkQuote);
  $("sendTo").addEventListener("input", invalidateSend);
  $("sendAmount").addEventListener("input", invalidateSend);
  $("walletMint").textContent = MINT;
  registry.subscribe(updateWalletOptions);
  updateWalletOptions();
})();
