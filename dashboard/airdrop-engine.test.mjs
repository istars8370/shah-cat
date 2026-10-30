import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENESIS_AIRDROP,
  campaignWindow,
  campaignStopReason,
  classifyApplications,
  buildPayoutPlan,
} from './airdrop-engine.mjs';

const walletA = '3xpeiDFFXZFuG6PbnzvqpenqoYN1mJeLqXbkbmgGcjTs';
const walletB = '9EAV9ujLscUFBcoS5UuixpZVMuULAU2DawY6ZGkpXvi9';
const startsAt = '2026-10-28T00:00:00.000Z';

function app(overrides = {}) {
  return {
    communityId: 'user-a',
    wallet: walletA,
    evidenceUrl: 'https://example.com/a',
    submittedAt: '2026-10-28T01:00:00.000Z',
    activities: ['join', 'externalPromotion'],
    flags: [],
    ...overrides,
  };
}

test('Genesis defaults enforce 0.2% / 30 days / 2,000 applications', () => {
  assert.equal(GENESIS_AIRDROP.durationDays, 30);
  assert.equal(GENESIS_AIRDROP.maxApplications, 2000);
  assert.equal(GENESIS_AIRDROP.totalBudgetRaw, 2_000_000_000_000_000n);
});

test('campaign window ends exactly after 30 days', () => {
  const before = campaignWindow({ startsAt, now: Date.parse('2026-11-26T23:59:59.999Z') });
  const atEnd = campaignWindow({ startsAt, now: Date.parse('2026-11-27T00:00:00.000Z') });
  assert.equal(before.ended, false);
  assert.equal(atEnd.ended, true);
});

test('duplicate wallet in same batch is rejected', () => {
  const rows = classifyApplications([
    app(),
    app({ communityId: 'user-b', evidenceUrl: 'https://example.com/b' }),
  ], { startsAt, now: Date.parse('2026-10-29T00:00:00.000Z') });
  assert.equal(rows[0].status, 'PASS');
  assert.equal(rows[1].status, 'REJECT');
  assert.match(rows[1].reason, /중복 지갑/);
});

test('duplicate evidence is rejected even with another wallet', () => {
  const rows = classifyApplications([
    app(),
    app({ communityId: 'user-b', wallet: walletB }),
  ], { startsAt, now: Date.parse('2026-10-29T00:00:00.000Z') });
  assert.equal(rows[1].status, 'REJECT');
  assert.match(rows[1].reason, /중복 증빙/);
});

test('review flags do not auto-pass', () => {
  const rows = classifyApplications([
    app({ flags: ['github-contribution'], activities: ['github:20'] }),
  ], { startsAt, now: Date.parse('2026-10-29T00:00:00.000Z') });
  assert.equal(rows[0].status, 'REVIEW');
  assert.equal(rows[0].score, 20);
});

test('campaign stops at the earliest hard condition', () => {
  assert.equal(campaignStopReason({
    startsAt,
    now: Date.parse('2026-10-29T00:00:00.000Z'),
    applicationCount: 2000,
  }), 'APPLICATION_HARD_CAP');
  assert.equal(campaignStopReason({
    startsAt,
    now: Date.parse('2026-11-28T00:00:00.000Z'),
    applicationCount: 1,
  }), 'TIME_LIMIT');
  assert.equal(campaignStopReason({
    startsAt,
    now: Date.parse('2026-10-29T00:00:00.000Z'),
    allocatedRaw: GENESIS_AIRDROP.totalBudgetRaw,
  }), 'BUDGET_CAP');
});

test('payout plan cannot exceed daily or total budget and requires human approval', () => {
  const rows = classifyApplications([
    app(),
    app({
      communityId: 'user-b',
      wallet: walletB,
      evidenceUrl: 'https://example.com/b',
      activities: ['video', 'testReport'],
    }),
  ], { startsAt, now: Date.parse('2026-10-29T00:00:00.000Z') });
  const plan = buildPayoutPlan(rows);
  assert.ok(plan.totalRaw <= GENESIS_AIRDROP.dailyPayoutCapRaw);
  assert.ok(plan.totalRaw <= GENESIS_AIRDROP.totalBudgetRaw);
  assert.equal(plan.requiresHumanApproval, true);
  assert.equal(plan.transactionCreated, false);
});

test('general recipient cap is 2% of campaign budget', () => {
  const rows = classifyApplications([
    app({ activities: ['github:100'] }),
  ], { startsAt, now: Date.parse('2026-10-29T00:00:00.000Z') });
  const plan = buildPayoutPlan(rows);
  const cap = GENESIS_AIRDROP.totalBudgetRaw * 200n / 10_000n;
  assert.equal(plan.payouts[0].amountRaw, cap);
});
