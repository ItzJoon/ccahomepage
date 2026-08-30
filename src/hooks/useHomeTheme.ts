"use client";

import { useContext } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { homeThemeStyles, DEFAULT_HOME_THEME, isHomeThemeKey, type HomeThemeKey } from "@/lib/homeTheme";
import { AdminThemeContext } from "@/components/admin/AdminThemeProvider";
import type { SiteTheme } from "@/lib/types";

/**
 * 현재 적용 중인 홈 화면/헤더/푸터 테마를 DB(site_theme)에서 실시간으로 가져온다.
 * /admin/theme에서 superadmin이 바꾸면 이 훅을 쓰는 모든 화면에 즉시 반영된다.
 *
 * 실시간 구독(useRealtimeList)은 처음 값을 받아오기 전까지 항상 빈 배열로 시작하므로,
 * 그 사이에는 DEFAULT_HOME_THEME(classic)으로 폴백해서 렌더링됐다 — 페이지를 이동할
 * 때마다 실제 테마(예: apple)가 나오기 전에 classic이 잠깐 깜빡이는 원인이었다. 서버
 * 컴포넌트에서 미리 조회해둔 값을 initial로 직접 넘겨주면 그 값으로, 넘겨주지 않았지만
 * AdminThemeProvider(admin/layout.tsx가 감싸둠) 안에서 호출됐다면 그 컨텍스트 값으로
 * 폴백해서, 관리자 화면의 개별 페이지마다 일일이 initial을 넘기지 않아도 첫 렌더부터
 * 정확한 테마가 그려진다.
 */
export function useHomeTheme(initial?: HomeThemeKey) {
  const { rows } = useRealtimeList<SiteTheme>("site_theme");
  const contextFallback = useContext(AdminThemeContext);
  const row = rows.find((r) => r.id === "default");
  const key = row && isHomeThemeKey(row.theme) ? row.theme : initial ?? contextFallback ?? DEFAULT_HOME_THEME;
  return { themeKey: key, t: homeThemeStyles[key] };
}
