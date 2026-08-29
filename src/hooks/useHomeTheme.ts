"use client";

import { useRealtimeList } from "@/hooks/useRealtimeList";
import { homeThemeStyles, DEFAULT_HOME_THEME, isHomeThemeKey } from "@/lib/homeTheme";
import type { SiteTheme } from "@/lib/types";

/**
 * 현재 적용 중인 홈 화면/헤더/푸터 테마를 DB(site_theme)에서 실시간으로 가져온다.
 * /admin/theme에서 superadmin이 바꾸면 이 훅을 쓰는 모든 화면에 즉시 반영된다.
 */
export function useHomeTheme() {
  const { rows } = useRealtimeList<SiteTheme>("site_theme");
  const row = rows.find((r) => r.id === "default");
  const key = row && isHomeThemeKey(row.theme) ? row.theme : DEFAULT_HOME_THEME;
  return { themeKey: key, t: homeThemeStyles[key] };
}
