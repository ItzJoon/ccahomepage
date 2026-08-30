"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const PrevPathContext = createContext<string | null>(null);

/**
 * 상세 페이지의 "뒤로가기" 링크가 "어디서 들어왔는지"를 판단할 때 쓴다 — 홈에서 바로
 * 들어왔으면 "← 홈으로", 그 외(목록/검색/직접 링크 등 — 전부 같은 목록 페이지로
 * 보내면 되므로 굳이 구분하지 않음)에는 "← [콘텐츠]로"를 보여주는 용도.
 */
export function usePrevPath() {
  return useContext(PrevPathContext);
}

/**
 * (site)/layout.tsx에 한 번만 마운트한다. 이 레이아웃은 사이트 내 이동에서 계속 같은
 * 컴포넌트 인스턴스로 남아있으므로(라우트 그룹 레이아웃이라 언마운트 안 됨), pathname이
 * 바뀔 때마다 "바뀌기 직전 경로"를 기록해뒀다가 context로 흘려보낸다.
 *
 * document.referrer는 브라우저 레벨의 실제 HTTP 이동에서만 갱신되고, Next.js
 * `<Link>`의 클라이언트 사이드 전환(history.pushState)에서는 갱신되지 않아서 SPA 안에서의
 * "직전 페이지"를 알아내는 용도로는 못 쓴다 — 그래서 pathname 변화를 직접 추적한다.
 * 새로고침하면 당연히 초기화되는데, 그 경우는 "이전 경로를 알 수 없음"과 같은 뜻이라
 * (요구사항상 목록 페이지로 보내는 기본값과 동일하게 처리되므로) 문제되지 않는다.
 */
export default function PrevPathProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState<string | null>(null);
  const currentRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentRef.current !== pathname) {
      setPrevPath(currentRef.current);
      currentRef.current = pathname;
    }
  }, [pathname]);

  return <PrevPathContext.Provider value={prevPath}>{children}</PrevPathContext.Provider>;
}
