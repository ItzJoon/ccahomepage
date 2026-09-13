/**
 * 관리자 화면 목록 테이블 공용 래퍼. 좁은 화면(모바일)에서 th/td 폭이 억지로 줄어들어
 * 텍스트가 한 글자씩 세로로 쌓이는 문제를 막기 위해, 테이블에 min-width를 주고 넘치는
 * 만큼은 (컬럼을 찌그러뜨리는 대신) 가로 스크롤로 보여준다. 새 관리자 테이블을 만들 때도
 * `<table className="w-full border-collapse bg-surface">` 대신 이 컴포넌트를 쓰면 자동으로
 * 같은 처리가 적용된다.
 */
export default function AdminTable({
  children,
  minWidth = 640,
  className = "",
  hasCardFallback = false,
}: {
  children: React.ReactNode;
  minWidth?: number;
  className?: string;
  /** true면 640px 미만에서 표 자체를 숨긴다 — 호출하는 화면이 그 자리에
   * AdminCardList로 만든 모바일 카드 목록을 별도로 나란히 렌더링해야 한다
   * (안 그러면 모바일에서 목록이 통째로 사라져 보인다). 기존 화면들은 이 prop을
   * 안 주면 지금처럼 계속 표+가로 스크롤로 보인다(하위호환, 기본값 false). */
  hasCardFallback?: boolean;
}) {
  return (
    <div className={`overflow-x-auto ${hasCardFallback ? "hidden sm:block" : ""}`}>
      <table className={`w-full border-collapse bg-surface ${className}`} style={{ minWidth }}>
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
