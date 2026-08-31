"use client";

import { createContext } from "react";
import { homeThemeStyles, type HomeThemeKey } from "@/lib/homeTheme";

/**
 * useHomeTheme.ts와 AdminThemeProvider.tsx가 서로를 import하는 순환 참조를 피하려고
 * Context 객체 정의만 이 파일로 분리했다. AdminThemeProvider가 admin 레이아웃 전체를
 * 대표해서 site_theme을 실시간 구독한 "살아있는" 값을 여기 담아두면, 각 관리자 페이지의
 * useHomeTheme()은(자기 몫의 구독이 아직 로딩 중이라도) 이 값을 폴백으로 써서 처음부터
 * 정확한 테마로 그려진다.
 */
export type ResolvedTheme = { themeKey: HomeThemeKey; t: (typeof homeThemeStyles)[HomeThemeKey] };

export const AdminThemeContext = createContext<ResolvedTheme | null>(null);
