// Pure offline content helpers. Workflow authority lives in the localhost handler.
export const CHANNELS = ['naver-cafe', 'naver-blog', 'discord'];
export const REVIEW_CHECKS = ['edited', 'rights', 'facts', 'commercial', 'likeness'];
const labels = { 'naver-cafe': 'Naver Cafe', 'naver-blog': 'Naver Blog', discord: 'Discord' };
const rules = {
  'naver-cafe': '카페 주제와 게시판 규칙 확인 · 제목/참여 질문 · 반복 홍보 금지',
  'naver-blog': '제목/소제목/본문 · 검색 키워드 자연스럽게 · 광고/협찬 표시 확인',
  discord: '짧은 공지/참여 안내 · 서버 규칙 확인 · 역할/전체 멘션은 수동 검토',
};
export function invalid(message = '제작 입력을 확인하세요.') {
  return Object.assign(new Error(message), { status: 400 });
}
export function boundedText(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
export function validateBrief(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    !CHANNELS.includes(input.channel) || !['short', 'medium', 'long'].includes(input.length)) throw invalid();
  const result = {};
  for (const [key, max] of [['brand', 80], ['industry', 80], ['purpose', 300], ['audience', 200]]) {
    if (!boundedText(input[key], 1, max)) throw invalid(`${key} 입력 길이/형식을 확인하세요.`);
    result[key] = input[key].trim();
  }
  return { ...result, channel: input.channel, length: input.length };
}
export function contentFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const result = {};
  for (const [key, min, max] of [['post', 1, 15000], ['hashtags', 0, 300], ['imagePrompt', 1, 2000]]) {
    if (!boundedText(value[key], min, max)) throw invalid(`${key} 입력 길이/형식을 확인하세요.`);
    result[key] = value[key].trim();
  }
  return result;
}
export function contentBundle(brief, baseContent, mode) {
  const tag = brief.brand.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 40) || '브랜드';
  const limit = { short: 250, medium: 600, long: 1200 }[brief.length];
  const demo = `[DEMO · ${labels[brief.channel]} 수동 편집용]\n` +
    `${brief.brand} | ${brief.industry} | ${brief.purpose}\n대상: ${brief.audience}\n` +
    `${rules[brief.channel]}\n\n${baseContent}`;
  return {
    ...contentFields({ post: mode === 'demo' ? demo.slice(0, limit) : baseContent,
      hashtags: `#${tag} #${brief.channel === 'discord' ? '커뮤니티' : brief.channel === 'naver-cafe' ? '소통' : '브랜드소식'}`,
      imagePrompt: `${brief.brand} / ${brief.industry}. 대상: ${brief.audience}. 목적: ${brief.purpose}. ` +
        '독창적인 브랜드 소개용 비주얼. 제3자 로고·실존 인물·무허가 원본 제외. 가격/성과 문구는 사실 검수 후 별도 배치. 이미지 API 호출 없이 제작 지시문만 제공.' }),
    metadata: { channel: labels[brief.channel], channelId: brief.channel, purpose: brief.purpose,
      length: brief.length, targetCharacters: limit, platformReview: rules[brief.channel],
      mode, published: false, imageGenerated: false },
  };
}
export function exportContent(record, format) {
  const snapshot = { status: 'EXPORTED', revision: record.revision, content: record.content,
    checks: record.checks, published: false, note: '수동 전달용. 플랫폼에 게시/전송되지 않았습니다.' };
  if (format === 'json') return JSON.stringify(snapshot, null, 2);
  if (format !== 'markdown') throw invalid('내보내기 형식을 확인하세요.');
  // Indented code blocks keep user/provider HTML, links and fences inert in Markdown viewers.
  const block = text => String(text).split('\n').map(line => `    ${line}`).join('\n');
  return '# 승인된 콘텐츠 · 수동 전달용\n\n게시/전송 미실행\n\n' +
    ['post', 'hashtags', 'imagePrompt'].map(key => `## ${key}\n\n${block(record.content[key])}\n`).join('\n') +
    `\n## metadata\n\n${block(JSON.stringify(snapshot, null, 2))}\n`;
}
