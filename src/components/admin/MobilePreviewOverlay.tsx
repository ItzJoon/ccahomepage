"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// 실제 콘텐츠가 인식하는 논리 뷰포트 폭 — 모바일 브레이크포인트 판단과 버튼/폰트 크기가
// 전부 이 폭 기준으로 렌더링된다. 프레임을 화면에 크게 보여주는 것과는 완전히 별개다.
const LOGICAL_WIDTH = 390;
// 9:16(1080x1920 기준) 비율을 그대로 적용한 논리 높이.
const LOGICAL_HEIGHT = Math.round((LOGICAL_WIDTH * 16) / 9);
// 상단 안내 바 + 여백이 차지하는 대략적인 높이 — 프레임 크기를 계산할 때 뷰포트 전체가
// 아니라 이만큼을 뺀 나머지를 기준으로 삼아야 안내 바와 겹치거나 밀려나지 않는다.
const CONTROL_BAR_RESERVE = 96;
const OUTER_PADDING = 32;

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
 *
 * 프레임을 화면에 "크게" 보여주는 것과 "iframe 안 레이아웃을 그대로 유지하는 것"은
 * 서로 다른 문제다 — iframe의 width를 그냥 키워버리면 미디어 쿼리 기준 자체가 커진
 * 뷰포트로 바뀌어서 데스크톱 레이아웃이 나와 버린다. 그래서 iframe 자체는 항상
 * LOGICAL_WIDTH(390) 그대로 렌더링하고, 그 결과물을 CSS transform: scale()로 확대해서
 * "화면에 보이는 크기"만 키운다 — 안의 버튼/폰트/레이아웃은 390px 기준 그대로다.
 * transform은 레이아웃 흐름상의 차지 공간을 바꾸지 않으므로, 감싸는 바깥 div를
 * 스케일된 실제 표시 크기로 잡고 overflow: hidden으로 잘라내야 주변 레이아웃이
 * 밀리지 않는다.
 */
export default function MobilePreviewOverlay({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [displaySize, setDisplaySize] = useState({ width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT });

  useEffect(() => {
    const computeSize = () => {
      const availableHeight = Math.max(window.innerHeight - CONTROL_BAR_RESERVE, 240);
      const availableWidth = Math.max(window.innerWidth - OUTER_PADDING, 200);

      // 세로 길이를 화면 높이의 90%로 잡고 9:16 비율로 가로 길이를 계산한다.
      let height = availableHeight * 0.9;
      let width = (height * 9) / 16;

      // 그 가로 길이가 화면 폭을 넘으면(좁은 창) 폭 기준으로 다시 축소해서 비율만 유지한다.
      if (width > availableWidth) {
        width = availableWidth;
        height = (width * 16) / 9;
      }

      setDisplaySize({ width, height });
    };

    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, []);

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

  const scale = displaySize.width / LOGICAL_WIDTH;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center gap-4 p-4 overflow-y-auto">
      <div className="flex items-center gap-3 shrink-0 mt-2">
        <span className="text-white text-sm font-bold">📱 모바일 화면 미리보기 (390px · 9:16)</span>
        <button
          type="button"
          onClick={onClose}
          className="bg-white text-navy text-sm font-bold rounded-lg px-3.5 py-2"
        >
          데스크톱으로 돌아가기
        </button>
      </div>
      <div className="bg-black rounded-[2.5rem] p-3 shadow-2xl shrink-0">
        <div
          className="bg-white rounded-[1.8rem] overflow-hidden relative"
          style={{ width: displaySize.width, height: displaySize.height }}
        >
          <iframe
            key={pathname}
            src={pathname}
            title="모바일 화면 미리보기"
            className="bg-white block absolute top-0 left-0 border-0"
            style={{
              width: LOGICAL_WIDTH,
              height: LOGICAL_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    </div>
  );
}
