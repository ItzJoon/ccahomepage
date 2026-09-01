"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const DesignerModeContext = createContext(false);

/** 지금 보고 있는 화면이 designer에게 조회 전용으로 잠겨 있는지 확인이 필요한 컴포넌트에서 쓴다. */
export function useDesignerMode() {
  return useContext(DesignerModeContext);
}

// middleware.ts의 superadminOnlyPrefixes와 AdminNav의 SUPERADMIN_NAV(+테마)에 해당하는
// 화면 목록 — designer의 쓰기 권한이 admin과 동일해진 뒤에도 이 화면들만은 superadmin
// 전용으로 남겨야 해서 그대로 조회 전용 잠금을 유지한다. /admin/badges는 이제 admin
// 역할은 실제로 접근/조작할 수 있게 됐지만(middleware.ts의 adminOnlyPrefixes로 이동),
// designer에게는 계속 조회 전용으로 남겨두기로 해서(뱃지는 RLS도 is_designer() 예외를
// 안 넣었다) 이 목록에는 그대로 둔다 — 두 목록이 완전히 같지 않은 게 정상이다.
const SUPERADMIN_ONLY_PREFIXES = [
  "/admin/access-requests",
  "/admin/badges",
  "/admin/users",
  "/admin/stats",
  "/admin/maintenance",
  "/admin/activity-logs",
  "/admin/feature-flags",
  "/admin/theme",
  "/admin/site-restrictions",
];

/**
 * designer 역할은 이제 admin과 동일한 수준으로 실제 콘텐츠(공지/뉴스/일정/게시판/Q&A/
 * 규정/부서 활동/신고 처리 등)를 쓸 수 있지만, superadmin 전용 화면(위 목록)은 여전히
 * 조회만 가능해야 한다(실제 차단은 RLS가 한다 — 이건 그 사실을 화면에서도 보여주는 UX
 * 레이어일 뿐). 화면마다 버튼/입력창에 개별적으로 disabled를 걸면 잊어버리기 쉬우므로,
 * 이 화면이 superadmin 전용인지를 경로로 판단해 `<main>` 콘텐츠 전체를 한 번에 잠근다.
 *
 * `inert`는 자식 트리 전체의 클릭·포커스·키보드 입력을 한 번에 막는 표준 HTML 속성이다
 * (텍스트 입력, 드래그 등도 포함 — `pointer-events: none`과 달리 키보드 접근까지 막아준다).
 * React 18 타입 정의에는 아직 `inert` prop이 없어서 DOM에 직접 설정한다.
 */
export default function DesignerModeGate({
  isDesigner,
  children,
}: {
  isDesigner: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSuperadminOnlyPage = SUPERADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const locked = isDesigner && isSuperadminOnlyPage;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current as (HTMLDivElement & { inert: boolean }) | null;
    if (el) el.inert = locked;
  }, [locked]);

  return (
    <DesignerModeContext.Provider value={locked}>
      {/* designer는 실제 디자인/화면을 있는 그대로 보는 게 목적이라(조회 전용 이름 그대로),
          화면을 흐리게 하거나 색을 바꾸지 않는다 — 상호작용 차단은 inert/pointer-events로만
          하고, 안내 메시지도 콘텐츠를 가리지 않도록 맨 아래에 둔다. */}
      <div ref={ref} className={locked ? "pointer-events-none select-none" : ""}>
        {children}
      </div>
      {locked && (
        <div className="bg-[#EAF0FB] text-blue text-xs font-bold text-center py-2 px-3 rounded-lg mt-4">
          🔒 조회 전용 화면(designer 계정) — superadmin 전용 메뉴라 볼 수는 있지만 저장·수정·
          삭제 등의 조작은 할 수 없습니다.
        </div>
      )}
    </DesignerModeContext.Provider>
  );
}
