"use client";

import { useContext } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { homeThemeStyles, DEFAULT_HOME_THEME, isHomeThemeKey, type HomeThemeKey } from "@/lib/homeTheme";
import { AdminThemeContext } from "@/lib/adminThemeContext";
import type { SiteTheme } from "@/lib/types";

/**
 * 현재 적용 중인 홈 화면/헤더/푸터/관리자 화면 테마를 DB(site_theme)에서 실시간으로
 * 가져온다. /admin/theme에서 superadmin이 바꾸면 이 훅을 쓰는 모든 화면에 즉시 반영된다.
 *
 * 이 훅을 쓰는 컴포넌트마다 useRealtimeList("site_theme")를 각자 새로 구독하는데,
 * 구독 직후엔 항상 rows가 빈 배열이라 자기 몫의 데이터가 도착하기 전까지 폴백 값으로
 * 렌더링된다. 관리자 화면에서 페이지를 이동할 때마다 그 페이지의 훅 인스턴스가 매번
 * 새로 마운트되므로, 이 폴백을 "레이아웃이 처음 마운트됐을 때 서버에서 한 번 조회해둔
 * 고정값"(initial)으로만 쓰면, 세션 중간에 테마를 바꾼 뒤 다른 관리자 페이지로 이동할
 * 때마다 그 예전 값이 잠깐 다시 나타났다 사라지는 문제가 있었다(관리자 레이아웃 자체는
 * 리마운트되지 않아 그 initial 값이 테마를 바꿔도 갱신되지 않기 때문). AdminThemeProvider
 * (admin/layout.tsx가 감싸둠)가 실시간으로 계속 갱신해서 컨텍스트에 담아두는 "살아있는"
 * 값을 initial보다 우선해서 폴백으로 쓰면, 그 사이에 테마가 바뀌었어도 항상 최신값으로
 * 즉시 그려진다. (site) 쪽 컴포넌트(Header/Footer/HomeContent 등)는 이 컨텍스트 밖에
 * 있으므로 여전히 각자 넘겨주는 initial을 그대로 쓴다.
 */
export function useHomeTheme(initial?: HomeThemeKey) {
  const { rows } = useRealtimeList<SiteTheme>("site_theme");
  const liveContext = useContext(AdminThemeContext);
  const row = rows.find((r) => r.id === "default");
  const key =
    row && isHomeThemeKey(row.theme)
      ? row.theme
      : liveContext?.themeKey ?? initial ?? DEFAULT_HOME_THEME;
  return { themeKey: key, t: homeThemeStyles[key] };
}
