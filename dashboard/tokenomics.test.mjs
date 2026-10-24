import test from "node:test";
import assert from "node:assert/strict";
import Policy from "./tokenomics.js";
import ShahCat from "./shared.js";
const raw = x => ShahCat.parseAmount(x);

test("v0.5 allocations total one billion without a new investor slot", () => {
  assert.equal(Policy.ALLOCATIONS.reduce((n, x) => n + raw(x.target), 0n), Policy.TOTAL_RAW);
  assert.equal(Policy.MEMBERS.reduce((n, x) => n + Policy.rawTarget(x.id), 0n), raw("500000000"));
  assert.equal(Policy.MEMBERS[2].target, "166666666");
  assert.ok(Object.isFrozen(Policy.MEMBERS[2]));
});

test("operators have no release at T12, first installment at T13 and complete at T36", () => {
  for (const id of ["seongjae", "dongwon"]) {
    assert.equal(Policy.vestingAtMonth(id, 0).releasedRaw, "0");
    assert.equal(Policy.vestingAtMonth(id, 12).releasedRaw, "0");
    assert.equal(Policy.vestingAtMonth(id, 12).nextMonth, 13);
    assert.equal(Policy.vestingAtMonth(id, 13).releasedRaw, String(raw("6944444.458333333")));
    assert.equal(Policy.vestingAtMonth(id, 24).releasedRaw, String(raw("83333333.5")));
    assert.equal(Policy.vestingAtMonth(id, 36).releasedRaw, String(raw("166666667")));
    assert.equal(Policy.vestingAtMonth(id, 36).nextMonth, null);
  }
});

test("investor receives exactly 10 percent at T0 and 90 percent in 24 installments without a cliff", () => {
  assert.equal(Policy.vestingAtMonth("parkwon", 0).releasedRaw, String(raw("16666666.6")));
  assert.equal(Policy.vestingAtMonth("parkwon", 0).nextReleaseRaw, String(raw("6249999.975")));
  assert.equal(Policy.vestingAtMonth("parkwon", 1).releasedRaw, String(raw("22916666.575")));
  assert.equal(Policy.vestingAtMonth("parkwon", 24).releasedRaw, String(raw("166666666")));
  assert.equal(Policy.vestingAtMonth("parkwon", 36).waitingRaw, "0");
});

test("every monthly schedule conserves base units and matches whitepaper annual boundaries", () => {
  const expected = new Map([[0,"16666666.6"],[12,"91666666.3"],[24,"333333333"],[36,"500000000"]]);
  for (const item of Policy.MEMBERS) {
    let previous = 0n, sum = 0n;
    for (let m = 0; m <= 36; m++) {
      const result = Policy.vestingAtMonth(item.id, m), released = BigInt(result.releasedRaw);
      assert.equal(released + BigInt(result.waitingRaw), Policy.rawTarget(item.id));
      assert.ok(released >= previous); sum += released - previous; previous = released;
    }
    assert.equal(sum, Policy.rawTarget(item.id));
  }
  for (const [month, value] of expected) {
    assert.equal(Policy.preview(month).releasedRaw, String(raw(value)));
    assert.equal(Policy.preview(month).t0, null);
    assert.equal(Policy.preview(month).onchainVestingVerified, false);
  }
});

test("invalid preview inputs and unknown members fail rather than truncate", () => {
  for (const month of [-1,37,1.1,NaN,Infinity,"12",null]) assert.throws(() => Policy.preview(month));
  assert.throws(() => Policy.vestingAtMonth("other",12), /Unknown/);
});

test("balance differences retain one base unit, zero and holdings above target", () => {
  const target = Policy.rawTarget("parkwon");
  assert.deepEqual(Policy.difference("parkwon", target + 1n), {
    targetRaw: String(target), heldRaw: String(target + 1n), deltaRaw: "-1", relation: "above",
  });
  assert.equal(Policy.difference("parkwon",0n).deltaRaw, String(target));
  assert.equal(Policy.difference("parkwon",target).relation,"equal");
  assert.throws(() => Policy.difference("parkwon", -1n));
});
