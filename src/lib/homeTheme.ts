/**
 * 헤더/푸터/홈 화면의 "스타일 값"을 테마별로 모아둔 진입점. 로고/내비 배열, 인증 처리,
 * 데이터 페칭 같은 로직은 각 컴포넌트에 그대로 두고, 색상·테두리·폰트 같은 값만 여기서
 * 테마별로 골라 쓴다.
 *
 * 각 테마의 실제 스타일 값은 src/lib/homeThemes/<테마명>.ts에 파일별로 분리돼 있고(공용
 * 타입은 homeThemes/types.ts), 이 파일은 그것들을 모아 homeThemeStyles로 합치기만 한다 —
 * 이 파일을 가져다 쓰는 쪽(Header/Footer/관리자 화면 등)은 homeThemeStyles/THEME_LABELS/
 * useHomeTheme 등 기존 이름을 그대로 쓰면 되고 변경이 필요 없다.
 *
 * 실제 어떤 테마가 적용 중인지는 DB(site_theme 테이블)에 저장되고, /admin/theme에서
 * superadmin이 바꾸면 useHomeTheme 훅(src/hooks/useHomeTheme.ts)이 실시간으로 반영한다.
 * 새 디자인이 필요해지면 homeThemes/ 밑에 파일을 하나 추가하고 아래 homeThemeStyles와
 * THEME_LABELS에 키를 더하면 관리자 화면에도 자동으로 선택지가 늘어난다.
 *
 * classic/green 테마는 실제로 한 번도 운영에 쓰이지 않고 삭제됐다(2026-10). apple이
 * 유일하게 써온 테마라 내부 키는 그대로 "apple"로 두되(DB site_theme.theme 값도 이미
 * 'apple'이라 바꿀 이유가 없음), 화면에 보이는 이름만 "기본"으로 바꿨다.
 */
import { appleTheme } from "./homeThemes/apple";

export const homeThemeStyles = {
  apple: appleTheme,
} as const;

export type HomeThemeKey = keyof typeof homeThemeStyles;

/** 관리자 화면(/admin/theme)의 선택지 이름표 */
export const THEME_LABELS: Record<HomeThemeKey, { label: string; description: string }> = {
  apple: { label: "기본", description: "화이트+블루(#2563eb), 부드러운 그림자, Caveat 손글씨 제목" },
};

/** DB(site_theme)에 아직 행이 없거나 값을 못 읽어왔을 때 쓰는 기본값 */
export const DEFAULT_HOME_THEME: HomeThemeKey = "apple";

export function isHomeThemeKey(value: string): value is HomeThemeKey {
  return value in homeThemeStyles;
}
