/**
 * 헤더/푸터/홈 화면의 "스타일 값"만 모아둔 파일. 로고/내비 배열, 인증 처리, 데이터 페칭 같은
 * 로직은 각 컴포넌트에 그대로 두고, 색상·테두리·폰트 같은 값만 여기서 테마별로 골라 쓴다.
 *
 * 디자인을 바꾸고 싶으면 아래 HOME_THEME 값만 바꾸면 된다(로직은 전혀 안 건드림).
 * 세 번째 디자인이 필요해지면 homeThemeStyles에 키를 하나 더 추가하면 되고, 그 사이에 이
 * 파일을 쓰는 컴포넌트에 실제 기능이 추가돼도 로직 쪽에 붙기 때문에 테마 전환은 항상 안전하다.
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

export const HOME_THEME: keyof typeof homeThemeStyles = "green";

export const homeTheme = homeThemeStyles[HOME_THEME];
