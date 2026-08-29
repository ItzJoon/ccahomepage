/**
 * 헤더/푸터/홈 화면의 "스타일 값"만 모아둔 파일. 로고/내비 배열, 인증 처리, 데이터 페칭 같은
 * 로직은 각 컴포넌트에 그대로 두고, 색상·테두리·폰트 같은 값만 여기서 테마별로 골라 쓴다.
 *
 * 실제 어떤 테마가 적용 중인지는 DB(site_theme 테이블)에 저장되고, /admin/theme에서
 * superadmin이 바꾸면 useHomeTheme 훅(src/hooks/useHomeTheme.ts)이 실시간으로 반영한다.
 * 세 번째 디자인이 필요해지면 아래 homeThemeStyles와 THEME_LABELS에 키를 하나 더 추가하면
 * 관리자 화면에도 자동으로 선택지가 늘어난다. 로직은 각 컴포넌트에 그대로 있으므로, 그 사이에
 * 실제 기능이 추가돼도 언제든 테마 전환이 안전하다.
 */
export const homeThemeStyles = {
  /** 원래 있던 navy/blue/gold 톤 (되돌리고 싶을 때 이 키로) */
  classic: {
    headerBg: "bg-navy",
    headerText: "text-white",
    headerBorder: "",
    logoFont: "",
    navActive: "bg-white/15 text-white",
    navIdle: "text-[#C9D2E3] hover:bg-white/10 hover:text-white",
    navText: "text-[#C9D2E3] hover:text-white",
    authBtn: "rounded-md border border-white/30 hover:bg-white/10",
    iconBtnHover: "hover:bg-white/10",
    mobileBorder: "border-t border-white/10",

    footerBg: "bg-[#EEF1F6]",
    footerText: "text-muted",
    footerBorder: "",

    heroBg: "bg-gradient-to-br from-navy to-blue",
    heroAccent: "",
    heroEyebrow: "text-gold",
    heroHeadingFont: "",
    heroPrimaryBtn: "bg-gold text-white font-bold text-sm rounded-lg px-[18px] py-2.5",
    heroSecondaryBtn: "border border-white/40 text-white font-bold text-sm rounded-lg px-[18px] py-2.5",

    cardRadius: "rounded-2xl",
    cardBorder: "border border-border",
    sectionEyebrow: "text-blue",
    sectionHeadingFont: "",
    sectionAccentBar: "hidden",

    noticeHover: "hover:bg-[#F2F4F8]",
    eventDateBg: "bg-navy rounded-lg",
    newsHoverBorder: "hover:border-blue",
    quickTile: "bg-[#F2F4F8] hover:bg-[#E7ECF5] rounded-xl",
  },
  /** Figma "Sneaker Product Page"(실제로는 학교 포털 목업) 참고 — 검정+초록 브루탈리즘 */
  green: {
    headerBg: "bg-white",
    headerText: "text-ink",
    headerBorder: "border-b-2 border-ink shadow-[0_2px_0_#1D6F42]",
    logoFont: "font-jua",
    navActive: "text-ccahGreen font-bold",
    navIdle: "text-ink hover:text-ccahGreen",
    navText: "text-ink hover:text-ccahGreen",
    authBtn: "rounded-none border-2 border-ink hover:bg-ink hover:text-white",
    iconBtnHover: "hover:bg-ccahGreenLight",
    mobileBorder: "border-t-2 border-ink",

    footerBg: "bg-ink",
    footerText: "text-white/60",
    footerBorder: "border-t-2 border-ccahGreen",

    heroBg: "bg-ink",
    heroAccent: "border-l-8 border-ccahGreen",
    heroEyebrow: "text-ccahGreenBright",
    heroHeadingFont: "font-jua",
    heroPrimaryBtn: "bg-ccahGreen text-white font-bold text-sm px-[18px] py-2.5",
    heroSecondaryBtn: "border-2 border-white text-white font-bold text-sm px-[18px] py-2.5",

    cardRadius: "rounded-none",
    cardBorder: "border-2 border-ink",
    sectionEyebrow: "text-ccahGreen",
    sectionHeadingFont: "font-jua",
    sectionAccentBar: "block",

    noticeHover: "hover:bg-ccahGreenLight",
    eventDateBg: "bg-ink",
    newsHoverBorder: "hover:border-ccahGreen",
    quickTile: "border border-ink hover:bg-ccahGreen hover:text-white",
  },
} as const;

export type HomeThemeKey = keyof typeof homeThemeStyles;

/** 관리자 화면(/admin/theme)의 선택지 이름표 */
export const THEME_LABELS: Record<HomeThemeKey, { label: string; description: string }> = {
  classic: { label: "클래식", description: "원래 있던 navy/blue/gold 톤, 둥근 카드" },
  green: { label: "그린 브루탈리즘", description: "검정+초록(#1D6F42), 굵은 테두리, Jua 폰트" },
};

/** DB(site_theme)에서 아직 값을 못 읽어왔을 때 쓰는 기본값 */
export const DEFAULT_HOME_THEME: HomeThemeKey = "green";

export function isHomeThemeKey(value: string): value is HomeThemeKey {
  return value in homeThemeStyles;
}
