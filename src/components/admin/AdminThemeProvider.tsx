"use client";

import { createContext } from "react";
import type { HomeThemeKey } from "@/lib/homeTheme";

/**
 * admin/layout.tsx가 서버에서 미리 조회해둔 site_theme 값을 관리자 화면 트리 전체에
 * 내려준다. useHomeTheme()이 이 값을 폴백으로 써서, 각 관리자 페이지가 매번
 * initialThemeKey를 직접 받지 않아도 realtime 구독 값이 도착하기 전까지 DEFAULT_HOME_THEME
 * (classic)로 렌더링됐다가 실제 테마(apple 등)로 바뀌는 깜빡임이 생기지 않는다.
 */
export const AdminThemeContext = createContext<HomeThemeKey | null>(null);

export default function AdminThemeProvider({
  initialThemeKey,
  children,
}: {
  initialThemeKey?: HomeThemeKey;
  children: React.ReactNode;
}) {
  return <AdminThemeContext.Provider value={initialThemeKey ?? null}>{children}</AdminThemeContext.Provider>;
}
