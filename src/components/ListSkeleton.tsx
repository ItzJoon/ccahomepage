/**
 * 목록형 페이지(공지/뉴스/게시판/Q&A/일정/구성원/생활규정/패치노트 등)가 전부
 * "use client" 컴포넌트라 서버는 빈 헤더/푸터 뼈대만 내려주고, 실제 목록은 마운트된
 * 뒤 useList/useRealtimeList가 브라우저에서 다시 Supabase를 조회해 채워 넣는다.
 * 그 사이(보통 수백 ms) 아무 표시도 없이 완전히 빈 화면이었다가 갑자기 내용이
 * 나타나서 "빈 화면 → 팝" 하고 끊겨 보이는 문제가 있었다 — 이 컴포넌트를
 * `loading && rows.length === 0`일 때 대신 보여줘서 그 순간을 자연스럽게 채운다.
 */
export default function ListSkeleton({
  rows = 4,
  rowClassName = "h-16 rounded-xl bg-[#EEF1F6] dark:bg-white/5",
}: {
  rows?: number;
  /** 기본값은 기존 목록형 페이지(공지/뉴스/게시판 등)의 테이블형 행 높이(h-16)와 맞춘
   * 것 — 한 줄짜리 좁은 행(홈 화면 블록처럼)처럼 실제 항목 높이가 더 낮은 곳에서는
   * 이 값을 좁혀서 스켈레톤과 실제 내용의 크기 차이(교체 시 레이아웃이 들썩이는 것)를
   * 줄일 수 있다. */
  rowClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 animate-pulse" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={rowClassName} />
      ))}
    </div>
  );
}
