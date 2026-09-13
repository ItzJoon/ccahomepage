"use client";

/**
 * 관리자 표(테이블) 화면들을 640px 미만에서 카드형 목록으로 보여주기 위한 공용 조각들.
 *
 * 화면마다 행 안에 배지·드롭다운·조건부 버튼 등 완전히 다른 내용이 들어있어서, 표
 * 마크업 하나를 자동으로 카드로 변환해주는 범용 컴포넌트는 만들 수 없었다 — 대신
 * "표와 카드를 둘 다 렌더링하고 CSS 반응형 클래스로 한쪽만 보여준다"는, 이 코드베이스가
 * 헤더의 데스크톱 nav/모바일 메뉴 전환에 이미 쓰고 있는 것과 같은 방식을 택했다(JS로
 * 뷰포트를 판단하지 않으므로 SSR/하이드레이션 시점 깜빡임이 없다). 각 관리자 화면은
 * 기존 <AdminTable hasCardFallback> 옆에 이 조각들로 조립한 <AdminCardList>를 나란히
 * 두기만 하면 되고, 카드 레이아웃 자체(제목 굵게 위, 부가정보 아래, 배지+액션 하단
 * 한 줄, 액션 버튼 44px 터치 타겟)는 여기서 한 번에 보장한다.
 */
export function AdminCardList({ children }: { children: React.ReactNode }) {
  return <div className="sm:hidden flex flex-col gap-3">{children}</div>;
}

export function AdminCard({
  children,
  onClick,
  faded = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  /** 숨김 처리된 글처럼 목록에서 흐리게 표시해야 하는 항목. */
  faded?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`border border-border rounded-xl p-4 bg-surface flex flex-col gap-2 ${onClick ? "cursor-pointer" : ""} ${
        faded ? "opacity-60" : ""
      }`}
    >
      {children}
    </div>
  );
}

/** 카드에서 가장 중요한 정보(제목/이름 등) — 굵게, 가장 눈에 띄게 상단에 둔다. */
export function AdminCardTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-bold text-base leading-snug break-words">{children}</div>;
}

/** 작성자/날짜 등 부가 정보 한 줄. 여러 조각을 넣으면 자동으로 줄바꿈된다. */
export function AdminCardMeta({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted flex items-center gap-1.5 flex-wrap min-w-0">{children}</div>;
}

/** 상태 배지 + 액션 버튼을 카드 하단에 한 줄로 배치한다(구분선으로 본문과 분리). */
export function AdminCardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-2 mt-1 border-t border-border">
      {children}
    </div>
  );
}

/** 카드 안 액션 버튼(숨김/삭제/차단 해제 등) 공용 스타일 — 최소 44px 터치 타겟을 보장한다. */
export function AdminCardAction({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`min-h-[44px] px-3.5 rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? "text-red bg-[#FDEBEC] dark:bg-white/10" : "text-blue bg-[#EAF0FB] dark:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
