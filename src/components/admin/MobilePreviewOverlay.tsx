"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 데스크톱 브라우저에서 "진짜" 모바일 폭으로 사이트를 미리 보는 도구(developer 전용).
 * 단순히 div 너비를 줄이는 방식은 안 된다 — CSS 미디어 쿼리(Tailwind의 sm:/md: 등)는
 * 감싸는 요소가 아니라 브라우저 뷰포트 자체의 폭을 보고 판단하기 때문에, 데스크톱
 * 창 안에서는 그대로 데스크톱 레이아웃으로 남는다. <meta name="viewport">를 다시
 * 정의하는 방법도 모바일 브라우저 전용 기능이라 데스크톱 크롬/사파리에는 아무 효과가
 * 없다. 그래서 iframe을 쓴다 — iframe은 그 자체로 독립된 뷰포트를 가지므로, width를
 * 390(iPhone 기준 대표 폭)으로 주면 그 안의 페이지는 실제로 390px 뷰포트로 렌더링되고
 * 미디어 쿼리도 정확히 모바일 브레이크포인트로 인식한다(같은 오리진이라 로그인 세션
 * 쿠키도 그대로 공유돼서 별도 인증 처리가 필요 없다).
 */
export default function MobilePreviewOverlay({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center gap-4 p-4 overflow-y-auto">
      <div className="flex items-center gap-3 shrink-0 mt-2">
        <span className="text-white text-sm font-bold">📱 모바일 화면 미리보기 (390px)</span>
        <button
          type="button"
          onClick={onClose}
          className="bg-white text-navy text-sm font-bold rounded-lg px-3.5 py-2"
        >
          데스크톱으로 돌아가기
        </button>
      </div>
      <div className="bg-black rounded-[2.5rem] p-3 shadow-2xl shrink-0">
        <iframe
          key={pathname}
          src={pathname}
          title="모바일 화면 미리보기"
          className="bg-white rounded-[1.8rem] block"
          style={{ width: 390, height: "min(844px, calc(100vh - 160px))" }}
        />
      </div>
    </div>
  );
}
