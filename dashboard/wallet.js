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
    } catch (e) {
      say(e?.code === 4001 ? "연결 요청을 취소했어요." : "연결 실패: " + (e?.message || "알 수 없는 오류"), true);
    } finally { $("connectWallet").disabled = false; render(); }
  }
  async function disconnect() {
    try { await provider()?.disconnect(); } catch (_) {}
    connected = null; render(); say("지갑 연결을 해제했습니다.");
  }
  $("connectWallet").addEventListener("click", connect);
  $("disconnectWallet").addEventListener("click", disconnect);
  const p = provider();
  if (p?.on) {
    p.on("disconnect", () => { connected = null; render(); say("지갑 연결이 해제됐습니다."); });
    p.on("accountChanged", publicKey => {
      connected = publicKey?.toBase58?.() || null;
      render(); say(connected ? "Phantom 계정이 변경됐습니다. 주소를 확인하세요." : "계정 연결이 해제됐습니다.");
    });
  }
  $("walletMint").textContent = MINT;
  render();
})();
