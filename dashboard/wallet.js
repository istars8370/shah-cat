// SHAH CAT Devnet wallet connection. No secret keys or transaction signing.
(() => {
  "use strict";
  const { MINT, DECIMALS, isPublicKey, rawAmount, parseAmount, amount, format } = ShahCat;
  const $ = id => document.getElementById(id);
  const provider = () => {
    const p = window.phantom?.solana || window.solana;
    return p?.isPhantom ? p : null;
  };
  let connected = null;
  let balanceRaw = null;
  let solLamports = null;
  let balanceCheckedAt = null;
  let balanceRequestId = 0;
  const invalidateSend = () => {
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
      if (data.network !== "devnet" || data.mint !== MINT || data.decimals !== DECIMALS || data.address !== address) {
        throw Error("네트워크, Mint 또는 조회 주소가 일치하지 않습니다.");
      }
      const checkedAt = Date.parse(data.checkedAt);
      if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > 60000 || checkedAt - Date.now() > 5000) throw Error("잔액 조회 시각이 유효하지 않습니다.");
      balanceRaw = rawAmount(data.shahRaw);
      solLamports = rawAmount(data.solLamports);
      balanceCheckedAt = checkedAt;
      $("connectedSol").textContent = format(amount(solLamports));
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
    if (!connected) {out.textContent="⚠ 먼저 Phantom을 연결하세요.";return;}
    if (balanceRaw === null) {out.textContent="⚠ 먼저 지갑 잔액을 조회하세요.";return;}
    if (Date.now() - balanceCheckedAt > 60000) { resetBalance("잔액 조회 후 60초가 지났습니다. 다시 조회하세요."); out.textContent="⚠ 최신 지갑 잔액을 다시 조회하세요."; return; }
    if (!isPublicKey(to)) {out.textContent="⚠ 수신 주소 형식이 올바르지 않습니다.";return;}
    if (to === connected) {out.textContent="⚠ 자기 자신에게 보내는 전송은 테스트에서 제외합니다.";return;}
    let raw;
    try { raw = parseAmount(value); } catch (_) {out.textContent="⚠ 수량은 소수점 9자리 이하이며 토큰 허용 범위 이내여야 합니다.";return;}
    if (raw <= 0n) {out.textContent="⚠ 0 SHAH는 전송할 수 없습니다.";return;}
    if (raw > balanceRaw) {out.textContent="⚠ SHAH 잔액이 부족합니다.";return;}
    if (solLamports < 10000000n) {out.textContent="⚠ 미리보기 기준으로 Devnet SOL 0.01 이상을 준비하세요. 실제 수수료 견적은 아닙니다.";return;}
    $("sendPreview").textContent = "Devnet 전송 미리보기 | Mint: " + MINT + " | 발신: " + connected + " | 수신: " + to + " | 수량: " + amount(raw) + " SHAH | 실제 서명: 비활성";
    out.textContent="✓ 입력 검증 통과. " + value + " SHAH → " + to + ". 실제 전송 및 서명은 아직 실행되지 않습니다.";
  }

  const say = (message, bad = false) => {
    $("walletMessage").textContent = message;
    $("walletMessage").className = bad ? "warn" : "muted";
  };
  function render() {
    $("walletAddress").textContent = connected || "연결 안 됨";
    $("connectWallet").hidden = !!connected;
    $("disconnectWallet").hidden = !connected;
    $("walletExplorer").hidden = !connected;
    if (connected) $("walletExplorer").href =
      "https://explorer.solana.com/address/" + encodeURIComponent(connected) + "?cluster=devnet";
  }
  async function connect() {
    const p = provider();
    if (!p) { say("Phantom 확장 프로그램을 찾지 못했어요. PC 브라우저에 설치하고 새로고침하세요.", true); return; }
    $("connectWallet").disabled = true;
    try {
      const response = await p.connect();
      connected = response.publicKey.toBase58();
      say("Phantom 지갑이 연결됐습니다. 연결만으로 토큰은 전송되지 않습니다.");
      refreshBalance();
    } catch (e) {
      say(e?.code === 4001 ? "연결 요청을 취소했어요." : "연결 실패: " + (e?.message || "알 수 없는 오류"), true);
    } finally { $("connectWallet").disabled = false; render(); }
  }
  async function disconnect() {
    try { await provider()?.disconnect(); } catch (_) {}
    connected = null; resetBalance(); render(); say("지갑 연결을 해제했습니다.");
  }
  $("connectWallet").addEventListener("click", connect);
  $("disconnectWallet").addEventListener("click", disconnect);
  const p = provider();
  if (p?.on) {
    p.on("disconnect", () => { connected = null; resetBalance(); render(); say("지갑 연결이 해제됐습니다."); });
    p.on("accountChanged", publicKey => {
      connected = publicKey?.toBase58?.() || null;
      resetBalance(); render(); if (connected) refreshBalance(); say(connected ? "Phantom 계정이 변경됐습니다. 주소를 확인하세요." : "계정 연결이 해제됐습니다.");
    });
  }
  $("reloadWalletBalance").addEventListener("click", refreshBalance);
  $("checkSend").addEventListener("click", validateSend);
  $("sendTo").addEventListener("input", invalidateSend);
  $("sendAmount").addEventListener("input", invalidateSend);
  $("walletMint").textContent = MINT;
  render();
})();