"use client";

import { useTheme } from "next-themes";

const OPTIONS = [
  { value: "light", label: "라이트 모드", icon: "☀️" },
  { value: "dark", label: "다크 모드", icon: "🌙" },
  { value: "system", label: "기기 설정에 맞춤", icon: "💻" },
] as const;

/**
 * 프로필 드롭다운(마이페이지/닉네임 수정/로그아웃) 안에 들어가는 라이트/다크/시스템
 * 3단 테마 선택 목록. 이 드롭다운 자체가 profileMenuOpen(항상 false로 시작하는 클라
 * 이언트 상태)일 때만 렌더링되므로 서버에는 애초에 그려지지 않는다 — 헤더에 항상
 * 노출되던 예전 아이콘 버튼(🌙/☀️)과 달리 hydration mismatch를 피할 mounted 체크가
 * 필요 없다.
 */
export default function ThemeMenuSection({ itemClassName }: { itemClassName: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={`flex items-center gap-2 ${itemClassName}`}
        >
          <span className="leading-none">{opt.icon}</span>
          <span className="flex-1">{opt.label}</span>
          {theme === opt.value && <span aria-hidden>✓</span>}
        </button>
      ))}
    </>
  );
}
