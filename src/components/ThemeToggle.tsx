"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useHomeTheme } from "@/hooks/useHomeTheme";

/**
 * 라이트/다크 모드 토글(🌙/☀️). next-themes(html.dark 클래스)를 그대로 쓰고, 버튼
 * 톤은 기존 검색 아이콘 버튼과 통일되도록 useHomeTheme()의 iconBtnHover를 재사용한다
 * (classic/green/apple 세 홈 테마 중 어떤 게 켜져 있어도 자연스럽게 어울린다).
 *
 * next-themes는 실제 테마(시스템 설정 포함)를 서버에서는 알 수 없어 마운트 전까지
 * `theme`가 정확하지 않다 — 마운트 전에 아이콘을 그려버리면 서버/클라이언트 렌더 결과가
 * 달라 hydration mismatch가 나므로, mounted 체크 전까지는 자리만 차지하는 빈 버튼을
 * 보여준다.
 */
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useHomeTheme();

  useEffect(() => setMounted(true), []);

  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  if (!mounted) {
    return <span className="w-9 h-9 shrink-0" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`w-9 h-9 flex items-center justify-center rounded-md text-base leading-none ${t.iconBtnHover}`}
      aria-label={resolvedTheme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      {resolvedTheme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
