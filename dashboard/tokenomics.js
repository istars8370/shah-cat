// v0.5 policy arithmetic only. Shared by classic browser scripts and Node.
// A projected release is not proof of funding, ownership, or on-chain vesting.
var ShahCatTokenomics = (() => {
  "use strict";
  const shared = typeof module === "object" && module.exports
    ? require("./shared.js") : ShahCat;
  const MINT = "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2";
  const DECIMALS = 9;
  const VERSION = "0.5";
  const TOTAL_RAW = 1000000000n * 10n ** 9n;
  const MEMBERS = Object.freeze([
    Object.freeze({ id: "seongjae", name: "성재", role: "운영 창립자", target: "166666667", cliffMonths: 12, installments: 24, immediateBps: 0 }),
    Object.freeze({ id: "dongwon", name: "동원", role: "운영 창립자", target: "166666667", cliffMonths: 12, installments: 24, immediateBps: 0 }),
    Object.freeze({ id: "parkwon", name: "박원", role: "초기 전략투자자", target: "166666666", cliffMonths: 0, installments: 24, immediateBps: 1000 }),
  ]);
  const ALLOCATIONS = Object.freeze([
    ["운영 창립자 2인", "333333334"], ["초기 전략투자자", "166666666"],
    ["유동성 확보", "150000000"], ["게임 및 생태계 보상", "100000000"],
    ["개발 및 운영", "100000000"], ["커뮤니티 성장", "50000000"],
    ["제휴 및 협력", "50000000"], ["비상 예비금", "50000000"],
  ].map(([name, target]) => Object.freeze({ name, target })));

  function assertProfile() {
    if (shared.NETWORK.cluster !== "devnet" || shared.MINT !== MINT || shared.DECIMALS !== DECIMALS) {
      throw Error("v0.5 policy is available only for the recorded SHAH Devnet mint and 9 decimals");
    }
  }
  function member(id) {
    const item = MEMBERS.find(x => x.id === id);
    if (!item) throw Error("Unknown allocation member");
    return item;
  }
  function rawTarget(id) { return shared.parseAmount(member(id).target, DECIMALS); }
  function vestingAtMonth(id, month) {
    assertProfile();
    if (!Number.isInteger(month) || month < 0 || month > 36) throw Error("Preview month must be an integer from 0 to 36");
    const item = member(id);
    const target = rawTarget(id);
    const immediate = target * BigInt(item.immediateBps) / 10000n;
    const restricted = target - immediate;
    const completed = Math.max(0, Math.min(item.installments, month - item.cliffMonths));
    const released = immediate + restricted * BigInt(completed) / BigInt(item.installments);
    const next = completed < item.installments ? Math.max(month + 1, item.cliffMonths + 1) : null;
    const nextRaw = next === null ? 0n : restricted * BigInt(completed + 1) / 24n - restricted * BigInt(completed) / 24n;
    return {
      id, month, targetRaw: String(target), immediateRaw: String(immediate),
      releasedRaw: String(released), waitingRaw: String(target - released), completedInstallments: completed,
      nextMonth: next, nextReleaseRaw: String(nextRaw),
    };
  }
  function preview(month) {
    const members = MEMBERS.map(item => ({ ...item, ...vestingAtMonth(item.id, month) }));
    const released = members.reduce((n, item) => n + BigInt(item.releasedRaw), 0n);
    return { version: VERSION, month, network: "devnet", mint: MINT, decimals: DECIMALS,
      t0: null, onchainVestingVerified: false, members,
      releasedRaw: String(released), waitingRaw: String(500000000n * 10n ** 9n - released) };
  }
  function difference(id, heldRaw) {
    const target = rawTarget(id);
    const held = shared.rawAmount(heldRaw);
    const delta = target - held;
    return { targetRaw: String(target), heldRaw: String(held), deltaRaw: String(delta),
      relation: delta === 0n ? "equal" : delta > 0n ? "below" : "above" };
  }
  return Object.freeze({ VERSION, MINT, DECIMALS, TOTAL_RAW, MEMBERS, ALLOCATIONS, assertProfile,
    member, rawTarget, vestingAtMonth, preview, difference });
})();
if (typeof module === "object" && module.exports) module.exports = ShahCatTokenomics;
