/** 공유 미리보기(og:description)용으로 순수 텍스트 본문을 적당한 길이로 자른다.
 * 리치 텍스트(HTML) 본문은 태그를 걷어내야 하므로 이 함수 대신 sanitizeHtml.ts의
 * noticeContentToPlainSummary를 쓴다. */
export function truncateForMeta(text: string, maxLength = 100): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}
