/**
 * 헤더/푸터/홈 화면의 "스타일 값"만 모아둔 파일. 로고/내비 배열, 인증 처리, 데이터 페칭 같은
 * 로직은 각 컴포넌트에 그대로 두고, 색상·테두리·폰트 같은 값만 여기서 테마별로 골라 쓴다.
 *
 * 실제 어떤 테마가 적용 중인지는 DB(site_theme 테이블)에 저장되고, /admin/theme에서
 * superadmin이 바꾸면 useHomeTheme 훅(src/hooks/useHomeTheme.ts)이 실시간으로 반영한다.
 * 세 번째 디자인이 필요해지면 아래 homeThemeStyles와 THEME_LABELS에 키를 하나 더 추가하면
 * 관리자 화면에도 자동으로 선택지가 늘어난다. 로직은 각 컴포넌트에 그대로 있으므로, 그 사이에
 * 실제 기능이 추가돼도 언제든 테마 전환이 안전하다.
 *
 * heroTitleText/heroSubtitleText만 예외적으로 "콘텐츠"에 가깝지만, apple 테마는 특정 Figma
 * 디자인(실제 학교 이름이 들어간 카피 포함)을 최대한 그대로 재현해달라는 요청으로 만들어져서
 * 그 문구까지 테마 값에 포함시켰다. classic/green은 기존 문구를 그대로 유지한다.
 */
export const homeThemeStyles = {
  /** 원래 있던 navy/blue/gold 톤 (되돌리고 싶을 때 이 키로) */
  classic: {
    headerBg: "bg-navy",
    headerText: "text-white",
    headerBorder: "",
    logoFont: "",
    navShape: "px-2.5 py-2 rounded-md text-sm",
    navActive: "bg-white/15 text-white",
    navIdle: "text-[#C9D2E3] hover:bg-white/10 hover:text-white",
    navText: "text-[#C9D2E3] hover:text-white",
    authBtn: "rounded-md border border-white/30 hover:bg-white/10",
    adminLogoutBtn: "rounded-md border border-white/30 hover:bg-white/10",
    iconBtnHover: "hover:bg-white/10",
    mobileBorder: "border-t border-white/10",
    profileTrigger: "rounded-md border border-white/30 hover:bg-white/10",
    profileDropdown: "bg-navy border border-white/20 rounded-lg shadow-lg",
    profileDropdownItem: "text-[#C9D2E3] hover:bg-white/10 hover:text-white",
    profileDropdownDanger: "text-red hover:bg-white/10",

    footerBg: "bg-[#EEF1F6]",
    footerText: "text-muted",
    footerBorder: "",

    heroCard: "bg-gradient-to-br from-navy to-blue text-white px-8 py-10 rounded-2xl mb-5",
    heroEyebrow: "text-xs font-bold tracking-widest uppercase mb-1 text-gold",
    heroEyebrowText: "STUDENT SELF-GOVERNANCE",
    heroTitleText: "학생이 만드는 학교, 학생자치회",
    heroHeadingClass: "text-3xl mb-2.5",
    heroSubtitleText: "공지·일정·소식을 한눈에 확인하고 여러분의 목소리를 Q&A로 전해주세요.",
    heroSubtextClass: "text-[#D7DEEC] mb-4",
    heroPrimaryBtn: "bg-gold text-white font-bold text-sm rounded-lg px-[18px] py-2.5",
    heroSecondaryBtn: "border border-white/40 text-white font-bold text-sm rounded-lg px-[18px] py-2.5",

    cardShape: "bg-white border border-border rounded-2xl",
    sectionEyebrow: "text-xs font-bold tracking-widest uppercase mb-1 text-blue",
    sectionHeadingClass: "text-[22px]",
    sectionAccentBar: "hidden",
    sectionAccentColor: "text-blue",
    sectionMoreBtn: "text-blue font-semibold text-sm",

    streakCard: "bg-white border border-border rounded-2xl px-4 py-3 mb-5",
    streakEmoji: "🔥 ",
    streakBadge: "bg-transparent text-teal font-bold text-sm px-0 py-0",
    streakBadgeDot: "hidden",
    streakCheckmark: " ✓",

    noticeHover: "hover:bg-[#F2F4F8]",
    eventDateBg: "bg-navy rounded-lg",
    newsHoverBorder: "hover:border-blue",
    quickTile: "bg-[#F2F4F8] hover:bg-[#E7ECF5] rounded-xl px-2 py-4",
    quickShowIcon: true,

    emptyStateWrap: "text-muted text-center py-6 text-sm w-full",
    emptyStateIconWrap: "hidden",
    emptyStateTitle: "",
    emptyStateDesc: "hidden",

    adminHeaderMuted: "text-[#C9D2E3]",
    adminNavActive: "bg-navy text-white font-bold",
    adminNavIdle: "text-navy hover:bg-[#F2F4F8]",
    adminAsideBorder: "border-border",
    adminNavIndicator: "hidden",
  },
  /** Figma "Sneaker Product Page"(실제로는 학교 포털 목업) 참고 — 검정+초록 브루탈리즘 */
  green: {
    headerBg: "bg-white",
    headerText: "text-ink",
    headerBorder: "border-b-2 border-ink shadow-[0_2px_0_#1D6F42]",
    logoFont: "font-jua",
    navShape: "px-2.5 py-2 rounded-md text-sm",
    navActive: "text-ccahGreen font-bold",
    navIdle: "text-ink hover:text-ccahGreen",
    navText: "text-ink hover:text-ccahGreen",
    authBtn: "rounded-none border-2 border-ink hover:bg-ink hover:text-white",
    adminLogoutBtn: "rounded-none border-2 border-ink hover:bg-ink hover:text-white",
    iconBtnHover: "hover:bg-ccahGreenLight",
    mobileBorder: "border-t-2 border-ink",
    profileTrigger: "rounded-none border-2 border-ink hover:bg-ink hover:text-white",
    profileDropdown: "bg-white border-2 border-ink rounded-none shadow-lg",
    profileDropdownItem: "text-ink hover:bg-ccahGreenLight",
    profileDropdownDanger: "text-red hover:bg-ccahGreenLight",

    footerBg: "bg-ink",
    footerText: "text-white/60",
    footerBorder: "border-t-2 border-ccahGreen",

    heroCard: "bg-ink border-l-8 border-ccahGreen text-white px-8 py-10 mb-5",
    heroEyebrow: "text-xs font-bold tracking-widest uppercase mb-1 text-ccahGreenBright",
    heroEyebrowText: "STUDENT SELF-GOVERNANCE",
    heroTitleText: "학생이 만드는 학교, 학생자치회",
    heroHeadingClass: "text-3xl mb-2.5 font-jua",
    heroSubtitleText: "공지·일정·소식을 한눈에 확인하고 여러분의 목소리를 Q&A로 전해주세요.",
    heroSubtextClass: "text-[#D7DEEC] mb-4",
    heroPrimaryBtn: "bg-ccahGreen text-white font-bold text-sm px-[18px] py-2.5",
    heroSecondaryBtn: "border-2 border-white text-white font-bold text-sm px-[18px] py-2.5",

    cardShape: "bg-white border-2 border-ink rounded-none",
    sectionEyebrow: "text-xs font-bold tracking-widest uppercase mb-1 text-ccahGreen",
    sectionHeadingClass: "text-[22px] font-jua",
    sectionAccentBar: "block",
    sectionAccentColor: "text-ccahGreen",
    sectionMoreBtn: "text-blue font-semibold text-sm",

    streakCard: "bg-white border-2 border-ink rounded-none px-4 py-3 mb-5",
    streakEmoji: "🔥 ",
    streakBadge: "bg-transparent text-teal font-bold text-sm px-0 py-0",
    streakBadgeDot: "hidden",
    streakCheckmark: " ✓",

    noticeHover: "hover:bg-ccahGreenLight",
    eventDateBg: "bg-ink",
    newsHoverBorder: "hover:border-ccahGreen",
    quickTile: "border border-ink hover:bg-ccahGreen hover:text-white px-2 py-4",
    quickShowIcon: true,

    emptyStateWrap: "text-muted text-center py-6 text-sm w-full",
    emptyStateIconWrap: "hidden",
    emptyStateTitle: "",
    emptyStateDesc: "hidden",

    adminHeaderMuted: "text-ink/60",
    adminNavActive: "bg-ink text-white font-bold",
    adminNavIdle: "text-ink hover:bg-ccahGreenLight",
    adminAsideBorder: "border-ink",
    adminNavIndicator: "hidden",
  },
  /** Figma "CCA-Hompage"(https://figma.com/design/pFbmBXTCxTyhTBLFZ9VCUe) 재현 — Apple 느낌의
   * 미니멀한 화이트/블루 톤. 색상·도형·타이포를 실제 디자인 값 그대로 옮겼다(단, 존재하지
   * 않는 링크를 새로 만들지는 않아서 푸터는 기존처럼 한 줄 카피만 유지). */
  apple: {
    headerBg: "bg-white",
    headerText: "text-appleInk",
    headerBorder: "border-b border-appleBorder",
    logoFont: "",
    navShape: "px-3 py-2 rounded-full text-[15px]",
    navActive: "text-appleInk font-bold",
    navIdle: "text-appleMuted hover:text-appleInk",
    navText: "text-appleMuted hover:text-appleInk",
    authBtn: "rounded-full border border-appleBorder bg-white hover:bg-appleBg",
    adminLogoutBtn: "rounded-lg border border-[#d9d9d9] bg-[#f2f2f2] text-[#4d4d4d] hover:bg-appleBg",
    iconBtnHover: "hover:bg-appleBg",
    mobileBorder: "border-t border-appleBorder",
    profileTrigger: "rounded-full border border-appleBorder bg-white hover:bg-appleBg",
    profileDropdown: "bg-white border border-appleBorder rounded-2xl shadow-lg",
    profileDropdownItem: "text-appleInk hover:bg-appleBg",
    profileDropdownDanger: "text-red hover:bg-appleBg",

    footerBg: "bg-white",
    footerText: "text-appleMuted",
    footerBorder: "border-t border-appleBorder",

    heroCard:
      "bg-white text-appleInk p-9 md:p-[72px] rounded-[28px] shadow-[0_18px_20px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.04)] mb-5",
    heroEyebrow:
      "inline-block bg-appleBlue text-white text-xs font-bold uppercase tracking-wide rounded-full px-2.5 py-1.5 mb-3",
    heroEyebrowText: "2026 CCHS Student Council",
    heroTitleText: "CCHS 학생자치회",
    heroHeadingClass: "font-caveat font-bold text-appleInk text-[42px] md:text-[56px] leading-[1.1] tracking-tight mb-2",
    heroSubtitleText: "2026 중앙기독고등학교 자치회가 전하는 학교 소식, 그리고 소통",
    heroSubtextClass: "text-appleMuted text-lg mb-4",
    heroPrimaryBtn:
      "bg-appleBlue text-white font-bold text-sm rounded-full px-5 py-3 shadow-[0_10px_12px_rgba(37,99,235,0.15)]",
    heroSecondaryBtn: "border border-appleBlue text-appleBlue font-bold text-sm rounded-full px-5 py-3 bg-white",

    cardShape: "bg-white rounded-[24px] shadow-[0_2px_5px_rgba(0,0,0,0.04)]",
    sectionEyebrow: "text-appleMuted text-xs font-medium uppercase tracking-wide mb-1",
    sectionHeadingClass: "text-[18px] font-bold text-appleBlue tracking-tight",
    sectionAccentBar: "hidden",
    sectionAccentColor: "text-appleBlue",
    sectionMoreBtn:
      "inline-flex items-center gap-1 rounded-full border border-appleBorder bg-white text-appleInk text-[13px] font-medium px-3 py-1.5",

    streakCard: "bg-white rounded-3xl shadow-[0_2px_5px_rgba(0,0,0,0.04)] px-6 py-4 mb-5",
    streakEmoji: "",
    streakBadge:
      "bg-appleBlue/10 border border-appleBlue text-appleBlue font-bold text-[13px] rounded-full px-4 py-2 flex items-center gap-1.5",
    streakBadgeDot: "inline-block w-2 h-2 rounded-full bg-appleBlue",
    streakCheckmark: "",

    noticeHover: "hover:bg-appleBg",
    eventDateBg: "bg-appleInk rounded-lg",
    newsHoverBorder: "hover:shadow-[0_2px_5px_rgba(0,0,0,0.08)]",
    quickTile: "bg-white border border-appleBorder rounded-[20px] hover:shadow-sm p-5",
    quickShowIcon: false,

    emptyStateWrap: "flex flex-col items-center justify-center gap-3 h-40 w-full",
    emptyStateIconWrap: "w-12 h-12 rounded-3xl bg-appleBg flex items-center justify-center text-2xl",
    emptyStateTitle: "font-bold text-appleInk text-sm",
    emptyStateDesc: "text-appleMuted text-sm text-center",

    adminHeaderMuted: "text-appleInk font-bold",
    adminNavActive: "bg-appleBlue/10 text-appleBlue font-bold",
    adminNavIdle: "text-appleInk hover:bg-appleBg font-medium",
    adminAsideBorder: "border-appleBorder",
    adminNavIndicator: "block ml-auto w-1 h-4 rounded bg-appleBlue",
  },
} as const;

export type HomeThemeKey = keyof typeof homeThemeStyles;

/** 관리자 화면(/admin/theme)의 선택지 이름표 */
export const THEME_LABELS: Record<HomeThemeKey, { label: string; description: string }> = {
  classic: { label: "클래식", description: "원래 있던 navy/blue/gold 톤, 둥근 카드" },
  green: { label: "그린 브루탈리즘", description: "검정+초록(#1D6F42), 굵은 테두리, Jua 폰트" },
  apple: { label: "애플 스타일", description: "화이트+블루(#2563eb), 부드러운 그림자, Caveat 손글씨 제목" },
};

/** DB(site_theme)에서 아직 값을 못 읽어왔을 때 쓰는 기본값 */
export const DEFAULT_HOME_THEME: HomeThemeKey = "green";

export function isHomeThemeKey(value: string): value is HomeThemeKey {
  return value in homeThemeStyles;
}
