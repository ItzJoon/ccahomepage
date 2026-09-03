import sanitizeHtml from "sanitize-html";

// isomorphic-dompurify(jsdom 기반)를 쓰다가 배포 직후 /notices에서 500이 났다 — jsdom은
// 내부적으로 동적 require를 많이 써서, Vercel의 서버리스 번들러(파일 트레이싱)가 실제로
// 필요한 파일을 다 못 찾아내는 경우가 흔하다(로컬 `next build && next start`에서는
// node_modules가 통째로 디스크에 있어서 재현되지 않고, 실제 배포판에서만 터진다).
// sanitize-html은 htmlparser2 기반 순수 JS라 이런 문제가 없어서 서버/클라이언트 양쪽에
// 안전하게 쓸 수 있다.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "span", "a"],
  allowedAttributes: {
    span: ["style"],
    a: ["href", "style"],
  },
  // style 속성은 에디터가 글씨 크기(font-size)를 표현하는 용도로만 쓴다. 혹시 다른
  // 경로로(직접 API 호출 등) 임의의 CSS가 들어와도 font-size 하나만 살아남게 막아서,
  // style 속성을 열어둔 것 자체가 새로운 XSS 통로가 되지 않게 한다.
  allowedStyles: {
    "*": { "font-size": [/^[\d.]+(px|em|rem|%)$/] },
  },
  allowedSchemes: ["http", "https"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }, true),
  },
};

/** 에디터가 저장한 공지 본문 HTML을 화면/이메일에 그대로 넣기 전에 정화한다. */
export function sanitizeNoticeHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

// 리치 텍스트 에디터 도입 전에 저장된 글은 순수 텍스트(줄바꿈 포함)라 HTML 태그가 없다.
// 이런 글도 같은 렌더링 경로(HTML)를 타야 하므로, 저장된 그대로 다시 HTML로 만들어준다 —
// DB는 건드리지 않고 렌더링 시점에만 변환한다.
function isLikelyHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function legacyPlainTextToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(URL_PATTERN, (url) => {
    const trailingMatch = url.match(/[).,!?;:'"、。]+$/);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const href = trailing ? url.slice(0, -trailing.length) : url;
    return `<a href="${href}">${href}</a>${trailing}`;
  });
  return linked.replace(/\n/g, "<br>");
}

/** 공지 본문(신규 리치 텍스트든 예전 순수 텍스트든)을 안전하게 렌더링 가능한 HTML로 만든다. */
export function noticeContentToSafeHtml(content: string): string {
  const html = isLikelyHtml(content) ? content : legacyPlainTextToHtml(content);
  return sanitizeNoticeHtml(html);
}
