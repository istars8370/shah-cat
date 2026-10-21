// SHAH CAT Devnet wallet connection. No secret keys or transaction signing.
(() => {
  "use strict";
  const MINT = "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
  const $ = id => document.getElementById(id);
  const provider = () => {
    const p = window.phantom?.solana || window.solana;
    return p?.isPhantom ? p : null;
  };
  let connected = null;
  let balanceRaw = null;
  let solLamports = null;
  let lastValidated = null;
  const resetBalance = () => {
    balanceRaw = null;
    solLamports = null;
    lastValidated = null;
    $("connectedSol").textContent = "—";
    $("connectedShah").textContent = "—";
    $("walletBalanceMessage").textContent = "지갑 연결 후 Devnet 잔액을 확인하세요.";
    $("sendMessage").textContent = "실제 전송은 비활성화되어 있습니다.";
  };
  async function refreshBalance() {
    if (!connected) { resetBalance(); return; }
    const address = connected;
    const btn = $("reloadWalletBalance");
    btn.disabled = true;
    $("walletBalanceMessage").textContent = "Devnet 잔액 조회 중...";
    try {
      const response = await fetch("/api/wallet?address=" + encodeURIComponent(address), {cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "조회 실패");
      if (connected !== address) return;
      balanceRaw = BigInt(data.shahRaw);
      solLamports = BigInt(data.solLamports);
      lastValidated = null;
      $("connectedSol").textContent = (Number(data.solLamports) / 1e9).toLocaleString("ko-KR",{maximumFractionDigits:9});
      $("connectedShah").textContent = Number(data.shah).toLocaleString("ko-KR",{maximumFractionDigits:9});
      $("walletBalanceMessage").textContent = "✓ Devnet 잔액 확인 완료 (" + new Date(data.checkedAt).toLocaleTimeString("ko-KR") + ")";
    } catch(e) {
      balanceRaw = null;
      solLamports = null;
      lastValidated = null;
      $("walletBalanceMessage").textContent = "⚠ 잔액 조회 실패: " + e.message;
    } finally {btn.disabled = false;}
  }
  function validateSend() {
    const to = $("sendTo").value.trim();
    const value = $("sendAmount").value.trim();
    const out = $("sendMessage");
    lastValidated = null;
    $("sendPreview").textContent = "검증 진행 중...";
    if (!connected) {out.textContent="⚠ 먼저 Phantom을 연결하세요.";return;}
if (balanceRaw === null) {
  out.textContent = "⚠ 먼저 지갑 잔액을 조회하세요.";
  $("sendPreview").textContent = "검증 실패";
  return;
}
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to)) {out.textContent="⚠ 수신 주소 형식이 올바르지 않습니다.";return;}
    if (to === connected) {out.textContent="⚠ 자기 자신에게 보내는 전송은 테스트에서 제외합니다.";return;}
    if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,9})?$/.test(value)) {out.textContent="⚠ 수량은 양수이며 소수점 9자리 이하여야 합니다.";return;}
    const [whole, fraction=""] = value.split(".");
    const raw = BigInt(whole)*1000000000n + BigInt(fraction.padEnd(9,"0"));
    if (raw <= 0n) {out.textContent="⚠ 0 SHAH는 전송할 수 없습니다.";return;}
    if (raw > balanceRaw) {out.textContent="⚠ SHAH 잔액이 부족합니다.";return;}
    if (solLamports === null || solLamports < 10000000n) {out.textContent="⚠ SOL 수수료 및 수신 토큰 계정 생성 비용에 대비해 Devnet SOL 0.01 이상을 준비하세요.";return;}
    lastValidated = { from: connected, to, amount: value, raw: raw.toString(), mint: MINT, network: "devnet" };
    $("sendPreview").textContent = "Devnet 전송 미리보기 | 발신: " + connected + " | 수신: " + to + " | 수량: " + value + " SHAH | 실제 서명: 비활성";
    out.textContent="✓ 입력 검증 통과. 실제 전송 및 Phantom 서명은 아직 실행되지 않습니다.";
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
  ["sendTo","sendAmount"].forEach(id => $(id).addEventListener("input", () => {
    lastValidated = null;
    $("sendPreview").textContent = "입력이 변경되었습니다. 다시 검증하세요.";
    $("sendMessage").textContent = "전송 검증이 필요합니다.";
  }));
  $("walletMint").textContent = MINT;
  render();
})();
