// SHAH CAT Airdrop System v0.1
// Deterministic local policy engine only.
// No keys, signing, broadcasting, custody, Treasury movement, or Mainnet actions.
import ShahCat from './shared.js';
import { CHANNEL_ACTIVITY_SCORE, normalizeChannel, channelEvidenceStatus } from './airdrop-channels.mjs';

const ONE_SHAH = 1_000_000_000n;
const toRaw = amount => BigInt(amount) * ONE_SHAH;

export const GENESIS_AIRDROP = Object.freeze({
  id: 'genesis-v1',
  durationDays: 30,
  maxApplications: 2_000,
  dailyApplicationCap: 150,
  totalBudgetRaw: toRaw(2_000_000),
  dailyPayoutCapRaw: toRaw(100_000),
  generalRecipientCapBps: 200, // 2% of campaign budget
});

export const SCORE = Object.freeze({
  ...CHANNEL_ACTIVITY_SCORE,
  join: 1,
  community: 1,
  helpfulReply: 1,
  originalPost: 3,
  externalPromotion: 5,
  visualContent: 5,
  video: 10,
  testReport: 10,
  bugReport: 20,
});

const REVIEW_FLAGS = new Set([
  'similar-content',
  'shared-device',
  'shared-network',
  'high-value-claim',
  'github-contribution',
  'security-report',
]);

const REJECT_FLAGS = new Set([
  'self-referral',
  'bought-engagement',
  'copied-content',
  'fake-evidence',
  'automation-spam',
]);

function fail(message) {
  throw Object.assign(new Error(message), { code: 'AIRDROP_POLICY' });
}

function cleanText(value, name, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(name + ' 입력 오류');
  return value.trim();
}

function isoMs(value, name) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(name + ' UTC 일시 오류');
  return ms;
}

function normalizeUrl(value) {
  if (value == null || value === '') return null;
  let url;
  try { url = new URL(value); } catch { fail('증빙 URL 오류'); }
  if (!['https:', 'http:'].includes(url.protocol)) fail('증빙 URL 프로토콜 오류');
  url.hash = '';
  return url.toString();
}

export function campaignWindow({ startsAt, now = Date.now(), config = GENESIS_AIRDROP }) {
  const start = isoMs(startsAt, '시작');
  const end = start + config.durationDays * 86_400_000;
  return {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    started: now >= start,
    ended: now >= end,
    remainingMs: Math.max(0, end - now),
  };
}

export function validateApplication(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('신청 형식 오류');
  const communityId = cleanText(input.communityId, '커뮤니티 ID', 120);
  const wallet = cleanText(input.wallet, '지갑', 64);
  if (!ShahCat.isPublicKey(wallet)) fail('Solana 공개주소 오류');
  const evidenceUrl = normalizeUrl(input.evidenceUrl);
  const { channel, channelUserId } = normalizeChannel(input);
  const submittedAtMs = isoMs(input.submittedAt, '제출');
  const activities = Array.isArray(input.activities) ? input.activities : [];
  if (!activities.length || activities.some(x => typeof x !== 'string' || !x.trim())) fail('활동 내역 오류');
  const flags = Array.isArray(input.flags) ? [...new Set(input.flags)] : [];
  if (flags.some(x => typeof x !== 'string' || x.length > 80)) fail('위험 플래그 오류');
  return {
    communityId,
    wallet,
    channel,
    channelUserId,
    evidenceUrl,
    submittedAt: new Date(submittedAtMs).toISOString(),
    activities: activities.map(x => x.trim()),
    flags,
  };
}

export function scoreApplication(application) {
  const app = validateApplication(application);
  let score = 0;
  for (const activity of app.activities) {
    if (Object.hasOwn(SCORE, activity)) score += SCORE[activity];
    else if (/^github:(?:[2-9]\d|100)$/.test(activity)) score += Number(activity.slice(7));
    else fail('알 수 없는 활동 점수');
  }
  return score;
}

export function classifyApplications(applications, {
  startsAt,
  now = Date.now(),
  existingApplications = 0,
  todayAccepted = 0,
  allocatedRaw = 0n,
  config = GENESIS_AIRDROP,
} = {}) {
  if (!Array.isArray(applications)) fail('신청 목록 오류');
  const window = campaignWindow({ startsAt, now, config });
  const wallets = new Set();
  const communityIds = new Set();
  const evidence = new Set();
  let intake = 0;

  return applications.map((input, index) => {
    let app;
    try { app = validateApplication(input); }
    catch (error) { return { index, status: 'REJECT', reason: error.message, application: null, score: 0 }; }

    let status = 'PASS';
    let reason = '자동 기본검증 통과';

    if (!window.started) [status, reason] = ['REJECT', '캠페인 시작 전'];
    else if (window.ended) [status, reason] = ['REJECT', '캠페인 종료'];
    else if (allocatedRaw >= config.totalBudgetRaw) [status, reason] = ['REJECT', '총 지급 상한 도달'];
    else if (existingApplications + intake >= config.maxApplications) [status, reason] = ['REJECT', '신청 Hard Cap 도달'];
    else if (todayAccepted + intake >= config.dailyApplicationCap) [status, reason] = ['REVIEW', '일일 신청 상한 도달'];
    else if (wallets.has(app.wallet)) [status, reason] = ['REJECT', '현재 배치 중복 지갑'];
    else if (communityIds.has(app.communityId)) [status, reason] = ['REJECT', '현재 배치 중복 커뮤니티 ID'];
    else if (app.evidenceUrl && evidence.has(app.evidenceUrl)) [status, reason] = ['REJECT', '현재 배치 중복 증빙'];
    else if (app.flags.some(x => REJECT_FLAGS.has(x))) [status, reason] = ['REJECT', '부정 참여 플래그'];
    else if (app.flags.some(x => REVIEW_FLAGS.has(x))) [status, reason] = ['REVIEW', '수동 검토 플래그'];
    else {
      const channelEvidence=channelEvidenceStatus(app);
      if(channelEvidence.review) [status,reason]=['REVIEW',channelEvidence.reason];
    }

    if (status !== 'REJECT') {
      wallets.add(app.wallet);
      communityIds.add(app.communityId);
      if (app.evidenceUrl) evidence.add(app.evidenceUrl);
      intake++;
    }

    let score = 0;
    if (status !== 'REJECT') {
      try { score = scoreApplication(app); }
      catch (error) { status = 'REJECT'; reason = error.message; score = 0; }
    }
    return { index, status, reason, application: app, score };
  });
}

export function campaignStopReason({
  startsAt,
  now = Date.now(),
  applicationCount = 0,
  allocatedRaw = 0n,
  config = GENESIS_AIRDROP,
}) {
  const window = campaignWindow({ startsAt, now, config });
  if (window.ended) return 'TIME_LIMIT';
  if (applicationCount >= config.maxApplications) return 'APPLICATION_HARD_CAP';
  if (allocatedRaw >= config.totalBudgetRaw) return 'BUDGET_CAP';
  return null;
}

export function buildPayoutPlan(rows, {
  remainingBudgetRaw = GENESIS_AIRDROP.totalBudgetRaw,
  remainingDailyRaw = GENESIS_AIRDROP.dailyPayoutCapRaw,
  config = GENESIS_AIRDROP,
} = {}) {
  if (!Array.isArray(rows)) fail('심사 결과 목록 오류');
  if (remainingBudgetRaw < 0n || remainingDailyRaw < 0n) fail('잔여 예산 오류');
  const eligible = rows.filter(x => x?.status === 'PASS' && Number.isInteger(x.score) && x.score > 0);
  const totalScore = eligible.reduce((sum, x) => sum + x.score, 0);
  if (!totalScore) return { totalRaw: 0n, payouts: [], heldRaw: remainingBudgetRaw };

  const available = [remainingBudgetRaw, remainingDailyRaw, config.totalBudgetRaw]
    .reduce((a, b) => a < b ? a : b);
  const personCap = config.totalBudgetRaw * BigInt(config.generalRecipientCapBps) / 10_000n;
  let totalRaw = 0n;
  const payouts = [];

  for (const row of eligible) {
    let raw = available * BigInt(row.score) / BigInt(totalScore);
    if (raw > personCap) raw = personCap;
    const left = available - totalRaw;
    if (raw > left) raw = left;
    if (raw <= 0n) continue;
    totalRaw += raw;
    payouts.push({
      wallet: row.application.wallet,
      communityId: row.application.communityId,
      score: row.score,
      amountRaw: raw,
      amountSHAH: ShahCat.amount(raw),
      status: 'PROPOSED',
    });
    if (totalRaw >= available) break;
  }

  return {
    totalRaw,
    totalSHAH: ShahCat.amount(totalRaw),
    payouts,
    heldRaw: remainingBudgetRaw - totalRaw,
    requiresHumanApproval: true,
    transactionCreated: false,
  };
}
