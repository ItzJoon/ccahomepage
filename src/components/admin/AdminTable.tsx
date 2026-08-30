/**
 * 관리자 화면 목록 테이블 공용 래퍼. 좁은 화면(모바일)에서 th/td 폭이 억지로 줄어들어
 * 텍스트가 한 글자씩 세로로 쌓이는 문제를 막기 위해, 테이블에 min-width를 주고 넘치는
 * 만큼은 (컬럼을 찌그러뜨리는 대신) 가로 스크롤로 보여준다. 새 관리자 테이블을 만들 때도
 * `<table className="w-full border-collapse bg-white">` 대신 이 컴포넌트를 쓰면 자동으로
 * 같은 처리가 적용된다.
 */
export default function AdminTable({
  children,
  minWidth = 640,
  className = "",
}: {
  children: React.ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse bg-white ${className}`} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

/**
 * 제목/내용처럼 긴 텍스트가 들어가는 셀에 쓴다. 한 줄로 표시하고 넘치면 말줄임표로
 * 자르며, title 속성으로 전체 내용을 마우스오버/길게 눌러 확인할 수 있게 한다.
 */
export function truncateCellProps(text: string, maxWidthPx = 260) {
  return {
    title: text,
    className: "block truncate",
    style: { maxWidth: maxWidthPx },
  } as const;
}
