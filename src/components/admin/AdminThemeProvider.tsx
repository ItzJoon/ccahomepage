"use client";

import { useHomeTheme } from "@/hooks/useHomeTheme";
import { AdminThemeContext } from "@/lib/adminThemeContext";
import type { HomeThemeKey } from "@/lib/homeTheme";

/**
 * admin 레이아웃 전체를 대표해서 site_theme을 한 번 구독하고, 그 "살아있는" 값(테마가
 * 바뀌면 실시간으로 갱신됨)을 컨텍스트에 담아 하위 모든 관리자 화면에 내려준다.
 * useHomeTheme()이 initial 없이 호출됐을 때 이 값을 폴백으로 써서, 개별 관리자 페이지가
 * 매번 initialThemeKey를 직접 받지 않아도 첫 렌더부터 최신 테마로 그려진다 — 세션 중간에
 * 테마를 바꾼 뒤 다른 관리자 페이지로 이동해도(그 페이지의 useRealtimeList 구독은 매번
 * 새로 시작해 빈 값에서 출발하므로) 예전 테마가 잠깐 다시 보였다 사라지지 않는다.
 */
export default function AdminThemeProvider({
  initialThemeKey,
  children,
}: {
  initialThemeKey?: HomeThemeKey;
  children: React.ReactNode;
}) {
  const resolved = useHomeTheme(initialThemeKey);
  return <AdminThemeContext.Provider value={resolved}>{children}</AdminThemeContext.Provider>;
}
