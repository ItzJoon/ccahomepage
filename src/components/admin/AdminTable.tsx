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

/**
 * 상태 배지/숨김·삭제 버튼처럼 짧은 요소 여러 개를 한 줄에 나란히 두는 셀에 쓴다.
 * 액션 열에 좁은 w-* 폭을 줘도(table-layout:auto라 폭은 힌트일 뿐이라), whitespace-nowrap이
 * 없으면 flex 자식이 기본 flex-shrink로 눌리면서 한글이 음절 단위로 줄바꿈될 수 있다
 * (예: "숨김"이 "숨"/"김"으로 분리). nowrap을 주면 그 대신 테이블 전체가 넓어지고
 * AdminTable의 overflow-x-auto가 가로 스크롤을 만들어 처리한다.
 */
export const actionCellClass = "flex items-center gap-2 whitespace-nowrap";
