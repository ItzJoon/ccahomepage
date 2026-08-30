"use client";

import { createContext, useContext, useEffect, useRef } from "react";

const DesignerModeContext = createContext(false);

/** designer(조회 전용) 계정으로 보고 있는지 확인이 필요한 컴포넌트에서 쓴다. */
export function useDesignerMode() {
  return useContext(DesignerModeContext);
}

/**
 * designer 역할은 모든 관리자 탭을 볼 수는 있지만 아무것도 수정/저장/삭제할 수 없어야 한다
 * (실제 차단은 RLS가 한다 — 이건 그 사실을 화면에서도 보여주는 UX 레이어일 뿐). 관리자
 * 화면마다 버튼/입력창에 개별적으로 disabled를 걸면 새 화면을 추가할 때마다 잊어버리기
 * 쉬우므로, `<main>` 콘텐츠 전체를 이 컴포넌트로 한 번만 감싸서 일괄 처리한다.
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current as (HTMLDivElement & { inert: boolean }) | null;
    if (el) el.inert = isDesigner;
  }, [isDesigner]);

  return (
    <DesignerModeContext.Provider value={isDesigner}>
      {/* designer는 실제 디자인/화면을 있는 그대로 보는 게 목적이라(조회 전용 이름 그대로),
          화면을 흐리게 하거나 색을 바꾸지 않는다 — 상호작용 차단은 inert/pointer-events로만
          하고, 안내 메시지도 콘텐츠를 가리지 않도록 맨 아래에 둔다. */}
      <div ref={ref} className={isDesigner ? "pointer-events-none select-none" : ""}>
        {children}
      </div>
      {isDesigner && (
        <div className="bg-[#EAF0FB] text-blue text-xs font-bold text-center py-2 px-3 rounded-lg mt-4">
          🔒 조회 전용 모드(designer 계정) — 모든 화면을 볼 수 있지만 저장·수정·삭제 등의
          조작은 할 수 없습니다.
        </div>
      )}
    </DesignerModeContext.Provider>
  );
}
