import { Fragment } from "react";

// URL 뒤에 붙은 문장부호(마침표/쉼표/괄호 등)까지 링크에 포함되지 않도록, 일단 넉넉하게
// 매치한 다음 뒤쪽 구두점만 따로 떼어낸다.
const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

/**
 * 게시글/댓글/답변 본문에 포함된 URL을 렌더링 시점에만 클릭 가능한 링크로 바꿔 보여준다.
 * 저장된 데이터 자체는 건드리지 않는다(항상 원본 텍스트를 그대로 저장하고, 표시할 때만
 * 이 컴포넌트를 거친다) — 나중에 링크 처리 방식이 바뀌어도 과거 글까지 동일하게 적용된다.
 */
export default function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        // text.split(capture-group)는 매치된 부분을 홀수 인덱스에 끼워 넣는다.
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const trailingMatch = part.match(/[).,!?;:'"、。]+$/);
        const trailing = trailingMatch ? trailingMatch[0] : "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <Fragment key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue underline break-all">
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
}
