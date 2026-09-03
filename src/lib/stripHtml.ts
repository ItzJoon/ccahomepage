// sanitizeHtml.ts와 별도 파일로 뺀 이유: 저 파일은 DOMPurify를 불러오는데, 이 함수만
// 필요한 클라이언트 화면(예: 검색 결과 요약)까지 그 무거운 의존성을 번들에 끌고 오게
// 된다. 이 함수는 순수 정규식이라 그럴 필요가 없다.

/** 목록/검색 결과 등 미리보기 영역에서 태그를 걷어낸 순수 텍스트 요약을 만든다. */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}
