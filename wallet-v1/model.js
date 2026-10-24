/* Shared pure wallet UI validation; no secrets, signing, or network access. */
var ShahWalletModel = (() => {
  "use strict";
  const safe = value => typeof value === "string" ? value.trim() : "";
  function normalizeContacts(raw, isAddress) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set(), result = [];
    for (const entry of raw) {
      const label = safe(entry?.label).slice(0,40);
      const address = safe(entry?.address);
      if (!label || !isAddress(address) || seen.has(address)) continue;
      result.push({ label, address });
      seen.add(address);
      if (result.length >= 20) break;
    }
    return result;
  }
  function addContact(contacts, label, address, isAddress) {
    const name = safe(label).slice(0,40), key = safe(address);
    if (!name || name.length > 40) throw Error("별칭은 1~40자로 입력하세요.");
    if (!isAddress(key)) throw Error("올바른 Solana 공개 주소를 입력하세요.");
    if (contacts.some(c => c.address === key)) throw Error("이미 주소록에 등록된 주소입니다.");
    if (contacts.length >= 20) throw Error("주소록에는 최대 20개를 저장할 수 있습니다.");
    return [...contacts, { label:name, address:key }];
  }
  function validBalance(body, address, config, now=Date.now()) {
    if (!body || body.network !== "devnet" || body.address !== address ||
        body.mint !== config.MINT || body.decimals !== config.DECIMALS) throw Error("잔액 조회의 지갑·네트워크·토큰 정보가 일치하지 않습니다.");
    const at = Date.parse(body.checkedAt);
    if (!Number.isFinite(at) || at > now+5000 || now-at > 60000) throw Error("오래되었거나 잘못된 잔액 조회입니다.");
    const shah = config.rawAmount(body.shahRaw), sol = config.rawAmount(body.solLamports);
    return { shah, sol, checkedAt:at };
  }
  function validQuote(body, expected, config, now=Date.now()) {
    if (!body || body.network !== "devnet" || body.mint !== config.MINT ||
        body.decimals !== config.DECIMALS || body.sender !== expected.sender ||
        body.recipient !== expected.recipient || body.rawAmount !== String(expected.rawAmount) ||
        body.simulationPassed !== true || body.signatureEnabled !== false ||
        body.broadcastingEnabled !== false || typeof body.recipientAtaExists !== "boolean" ||
        body.requiresAtaCreation !== !body.recipientAtaExists ||
        !config.isPublicKey(body.recipientAta) || !config.isPublicKey(body.sourceTokenAccount)) {
      throw Error("시뮬레이션 검증값이 현재 주소·토큰·네트워크와 일치하지 않습니다.");
    }
    const at = Date.parse(body.checkedAt);
    if (!Number.isFinite(at) || at > now+5000 || now-at > 30000) throw Error("시뮬레이션 유효 시간이 지났습니다.");
    const fee = config.rawAmount(body.feeLamports), rent = config.rawAmount(body.rentLamports);
    if (body.totalPlannedSolLamports !== String(fee+rent)) throw Error("수수료·ATA 예치금 합계가 일치하지 않습니다.");
    if (fee < 0n || rent < 0n) throw Error("잘못된 수수료 값입니다.");
    return { fee, rent };
  }
  function validHistory(data, address, config, now=Date.now()) {
    if (!data || data.network !== "devnet" || data.address !== address || data.mint !== config.MINT ||
        data.limited !== true || !Array.isArray(data.transactions) || data.transactions.length > 12) {
      throw Error("거래내역의 주소·네트워크·응답 형식이 유효하지 않습니다.");
    }
    const at = Date.parse(data.checkedAt);
    if (!Number.isFinite(at) || at>now+5000 || now-at>60000) throw Error("거래내역 조회 시각이 유효하지 않습니다.");
    return data.transactions.map(tx => {
      if (!tx || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(tx.signature) ||
          !["입금","출금"].includes(tx.direction) || !/^[1-9][0-9]*$/.test(tx.rawAmount) ||
          typeof tx.amount !== "string" || !/^([0-9]+)(\.[0-9]{1,9})?$/.test(tx.amount) ||
          !Number.isFinite(Date.parse(tx.timestamp))) throw Error("잘못된 Devnet 거래 기록입니다.");
      return { signature:tx.signature,direction:tx.direction,amount:tx.amount,timestamp:tx.timestamp,rawAmount:tx.rawAmount };
    });
  }
  return Object.freeze({ normalizeContacts,addContact,validBalance,validQuote,validHistory });
})();
if (typeof module === "object" && module.exports) module.exports = ShahWalletModel;
