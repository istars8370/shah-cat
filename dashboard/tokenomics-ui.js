// Read-only local policy preview and unverified public-address comparison.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const policy = ShahCatTokenomics;
  const fmt = raw => ShahCat.format(ShahCat.amount(raw, policy.DECIMALS));
  const signed = raw => { const n = BigInt(raw); return (n < 0n ? "−" : "") + fmt(n < 0n ? -n : n); };
  const row = (parent, values) => {
    const tr = document.createElement("tr");
    for (const text of values) { const td = document.createElement("td"); td.textContent = text; tr.append(td); }
    parent.append(tr);
  };
  let generation = 0, controller = null, report = null;
  const addresses = () => Object.fromEntries(policy.MEMBERS.map(x => [x.id, $("allocationAddress-" + x.id).value.trim()]));
  function renderAudit(data = null) {
    const body = $("allocationResults"); body.replaceChildren();
    for (const item of policy.MEMBERS) {
      const entry = data?.members.find(x => x.id === item.id);
      const observed = entry?.status === "observed";
      const status = observed ? (BigInt(entry.frozenRaw) > 0n ? "잔액 조회 · 동결분 포함" : "잔액 조회 · 소유자 미확인") :
        entry?.status === "error" ? "조회 실패 · 잔액 미확인" : "주소 미확정 · 미조회";
      const cells = [item.name + " · " + item.role, fmt(policy.rawTarget(item.id)),
        observed ? fmt(entry.heldRaw) : "—", observed ? signed(entry.deltaRaw) : "—", status];
      row(body, cells);
    }
  }
  function invalidate() {
    ++generation; controller?.abort(); controller = null; report = null;
    $("auditAllocations").disabled = false;
    $("downloadAllocationAudit").disabled = true;
    $("allocationCheckedAt").textContent = "";
    $("allocationMessage").textContent = "주소 변경 · 다시 대조해 주세요. 이전 조회 결과를 지웠습니다.";
    renderAudit();
  }
  function renderPreview() {
    const input = $("vestingMonth").value;
    try {
      if (!/^(0|[1-9][0-9]?)$/.test(input)) throw Error("0~36 사이의 정수 월차를 입력하세요.");
      const data = policy.preview(Number(input));
      $("vestingReleased").textContent = fmt(data.releasedRaw) + " SHAH";
      $("vestingWaiting").textContent = fmt(data.waitingRaw) + " SHAH";
      $("vestingMessage").textContent = "T" + data.month + " 정책 미리보기 · 실제 잠금·청구 가능량 미검증";
      const body = $("vestingMembers"); body.replaceChildren();
      for (const item of data.members) row(body, [item.name + " · " + item.role, fmt(item.targetRaw),
        fmt(item.releasedRaw), fmt(item.waitingRaw), item.nextMonth === null ? "예정 해제 종료" :
          "T" + item.nextMonth + " · " + fmt(item.nextReleaseRaw)]);
    } catch (_) {
      $("vestingReleased").textContent = "—"; $("vestingWaiting").textContent = "—";
      $("vestingMembers").replaceChildren();
      $("vestingMessage").textContent = "0~36 사이의 정수 월차를 입력하세요.";
    }
  }
  function validateReport(data, requested) {
    if (data.policyVersion !== policy.VERSION || data.network !== "devnet" || data.mint !== policy.MINT ||
        data.decimals !== policy.DECIMALS || data.signatureEnabled !== false || data.broadcastingEnabled !== false ||
        data.networkVerified !== true || typeof data.checkedAt !== "string" || !Number.isFinite(Date.parse(data.checkedAt)) ||
        !Array.isArray(data.members) || data.members.length !== policy.MEMBERS.length) throw Error("대조 응답의 네트워크·정책 정보가 일치하지 않습니다.");
    ShahCat.rawAmount(data.supplyRaw);
    if (data.supplyMatchesPolicy !== (BigInt(data.supplyRaw) === policy.TOTAL_RAW)) throw Error("발행량 검증 정보가 일치하지 않습니다.");
    const seen = new Set();
    for (const entry of data.members) {
      const item = policy.member(entry.id);
      if (seen.has(entry.id) || entry.address !== (requested[item.id] || null) || entry.targetRaw !== String(policy.rawTarget(item.id)) ||
          entry.identityVerified !== false || entry.allocationVerified !== false || entry.lockVerified !== false ||
          !["observed", "error", "unconfigured"].includes(entry.status) ||
          (entry.status === "unconfigured") !== !requested[item.id]) throw Error("주소 또는 배분 대상이 일치하지 않습니다.");
      seen.add(entry.id);
      if (entry.status === "observed") {
        const delta = policy.difference(item.id, entry.heldRaw);
        if (entry.deltaRaw !== delta.deltaRaw || entry.relation !== delta.relation ||
            ShahCat.rawAmount(entry.frozenRaw) > BigInt(entry.heldRaw) || BigInt(entry.heldRaw) > BigInt(data.supplyRaw)) {
          throw Error("잔액 대조 계산이 일치하지 않습니다.");
        }
      } else if (entry.heldRaw !== null || entry.deltaRaw !== null) throw Error("미확인 잔액을 표시할 수 없습니다.");
    }
  }
  async function audit(event) {
    event.preventDefault(); invalidate();
    const mine = generation, requested = addresses();
    try {
      const used = new Set();
      for (const address of Object.values(requested)) {
        if (!address) continue;
        if (!ShahCat.isPublicKey(address)) throw Error("Solana 공개주소를 확인하세요.");
        if (used.has(address)) throw Error("같은 주소를 여러 사람에게 연결할 수 없습니다.");
        used.add(address);
      }
      if (!used.size) throw Error("대조할 공개주소를 하나 이상 입력하세요.");
      controller = new AbortController();
      $("auditAllocations").disabled = true;
      $("allocationMessage").textContent = "Devnet 네트워크·Mint·주소별 잔액 대조 중…";
      const params = new URLSearchParams(Object.entries(requested).filter(([, value]) => value));
      const response = await fetch("/api/allocations?" + params, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (mine !== generation) return;
      if (!response.ok) throw Error(data.error || "Devnet 조회 실패");
      validateReport(data, requested);
      report = data; renderAudit(data);
      const observed = data.members.filter(x => x.status === "observed").length;
      const failed = data.members.filter(x => x.status === "error").length;
      $("allocationMessage").textContent = (data.supplyMatchesPolicy ? "" : "⚠ 실제 Devnet 발행량이 정책 총량과 다릅니다. ") +
        observed + "개 주소 잔액 확인" + (failed ? " · " + failed + "개 조회 실패" : "") + " · 배분 완료·소유권·실제 잠금은 미검증";
      $("allocationCheckedAt").textContent = "조회 시각: " + data.checkedAt + " · 주소별 confirmed 슬롯은 서로 다를 수 있습니다.";
      $("downloadAllocationAudit").disabled = false;
    } catch (error) {
      if (mine !== generation) return;
      report = null; renderAudit();
      $("allocationMessage").textContent = "⚠ " + (error.message || "조회 실패") + " 잔액을 0으로 대체하지 않았습니다.";
    } finally {
      if (mine === generation) { $("auditAllocations").disabled = false; controller = null; }
    }
  }
  function download() {
    if (!report) return;
    const csvCell = value => '"' + String(value ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""') + '"';
    const header = ["checked_at_utc", "policy_version", "network", "mint", "member_id", "input_address_unverified", "target_shah", "observed_shah", "target_minus_balance_shah", "status", "confirmed_slot", "identity_verified", "allocation_verified", "lock_verified"];
    const rows = report.members.map(x => [report.checkedAt, report.policyVersion, report.network, report.mint,
      x.id, x.address, ShahCat.amount(x.targetRaw), x.status === "observed" ? ShahCat.amount(x.heldRaw) : "",
      x.status === "observed" ? (BigInt(x.deltaRaw) < 0n ? "-" : "") + ShahCat.amount(BigInt(x.deltaRaw) < 0n ? -BigInt(x.deltaRaw) : BigInt(x.deltaRaw)) : "",
      x.status, x.slot, false, false, false]);
    const blob = new Blob(["\uFEFF" + [header, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "SHAH_Devnet_Allocation_Comparison.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  try {
    policy.assertProfile(); renderPreview(); renderAudit();
    const schedule = $("vestingSchedule"); let previous = 0n;
    for (let month = 0; month <= 36; month++) {
      const released = BigInt(policy.preview(month).releasedRaw);
      row(schedule, ["T" + month, fmt(released - previous), fmt(released)]); previous = released;
    }
    $("vestingMonth").addEventListener("input", renderPreview);
    for (const item of policy.MEMBERS) $("allocationAddress-" + item.id).addEventListener("input", invalidate);
    $("allocationForm").addEventListener("submit", audit);
    $("downloadAllocationAudit").addEventListener("click", download);
  } catch (_) {
    $("auditAllocations").disabled = true; $("downloadAllocationAudit").disabled = true;
    $("vestingMessage").textContent = "현재 프로젝트 설정은 SHAH v0.5 정책의 Mint·소수점과 다릅니다.";
    $("allocationMessage").textContent = "프로젝트 설정을 확인하기 전에는 대조를 실행하지 않습니다.";
  }
})();
