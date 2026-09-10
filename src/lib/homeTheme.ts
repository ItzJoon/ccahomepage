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

    footerBg: "bg-[#EEF1F6] dark:bg-[#161b26]",
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

    cardShape: "bg-surface border border-border rounded-2xl",
    sectionEyebrow: "text-xs font-bold tracking-widest uppercase mb-1 text-blue",
    sectionHeadingClass: "text-[22px]",
    sectionAccentBar: "hidden",
    sectionAccentColor: "text-blue",
    sectionMoreBtn: "text-blue font-semibold text-sm",

    streakCard: "bg-surface border border-border rounded-2xl px-4 py-3 mb-5",
    streakEmoji: "🔥 ",
    streakBadge: "bg-transparent text-teal font-bold text-sm px-0 py-0",
    streakBadgeDot: "hidden",
    streakCheckmark: " ✓",

    noticeHover: "hover:bg-[#F2F4F8] dark:hover:bg-[#1a2030]",
    eventDateBg: "bg-navy rounded-lg",
    newsHoverBorder: "hover:border-blue",
    quickTile: "bg-[#F2F4F8] hover:bg-[#E7ECF5] dark:bg-[#1a2030] dark:hover:bg-[#232a3d] rounded-xl px-2 py-4",
    quickShowIcon: true,

    emptyStateWrap: "text-muted text-center py-6 text-sm w-full",
    emptyStateIconWrap: "hidden",
    emptyStateTitle: "",
    emptyStateDesc: "hidden",

    adminHeaderMuted: "text-[#C9D2E3]",
    adminNavActive: "bg-navy text-white font-bold",
    adminNavIdle: "text-navy dark:text-white hover:bg-[#F2F4F8] dark:hover:bg-white/10",
    adminAsideBorder: "border-border",
    adminNavIndicator: "hidden",

    dashStatCard: "bg-surface border border-border rounded-2xl p-6",
    dashStatCardWarn: "bg-surface border-2 border-gold rounded-2xl p-6",
    dashStatIconBg: "bg-[#F2F4F8] dark:bg-white/10 rounded-full p-2",
    dashStatValue: "text-navy dark:text-white",
    dashStatValueWarn: "text-gold",
    dashActionPrimary: "bg-gold text-white font-bold text-sm rounded-lg px-5 py-3",
    dashActionSecondary: "border border-navy text-navy dark:border-white/25 dark:text-white font-bold text-sm rounded-lg px-5 py-3 bg-surface",
    dashActivityCard: "bg-surface border border-border rounded-2xl p-6",
    dashActivityTagNotice: "bg-[#EAF0FB] dark:bg-white/10 text-blue",
    dashActivityTagNews: "bg-[#E6F5F0] dark:bg-white/10 text-teal",
    dashActivityViewAllBtn: "border border-navy text-navy dark:border-white/25 dark:text-white text-sm font-bold rounded-lg px-3 py-1.5 bg-surface",

    /** 목록형 관리자 화면(공지/뉴스/일정/게시판/Q&A/구성원 등) 공용 토큰 — 원래 있던 값 그대로라
     * classic을 고르면 시각적으로 전혀 달라지지 않는다. */
    adminBtnPrimary: "bg-gold text-white font-bold text-sm rounded-lg px-4 py-2",
    adminBtnSecondary: "border border-border text-sm rounded-lg px-4 py-2 bg-surface",
    adminBtnDanger: "text-red text-xs font-bold",
    adminToggleActive: "bg-navy text-white border-navy",
    adminToggleIdle: "border-border",
    adminInput: "border border-border rounded-lg px-2.5 py-2 text-sm",
    adminTableHeaderCell: "text-left text-xs text-muted border-b-2 border-border p-2",
    adminTableRowHover: "hover:bg-[#F2F4F8] dark:hover:bg-white/10",
    adminTableRowActive: "bg-[#EAF0FB] dark:bg-white/10",
    adminTableCell: "p-2.5 border-b border-border text-sm",
    adminEditPanel: "bg-surface border border-border rounded-xl p-[18px]",
  },
  /** Figma "Sneaker Product Page"(실제로는 학교 포털 목업) 참고 — 검정+초록 브루탈리즘 */
  green: {
    headerBg: "bg-surface",
    headerText: "text-ink",
    headerBorder: "border-b-2 border-ink shadow-[0_2px_0_var(--ccah-green)]",
    logoFont: "font-jua",
    navShape: "px-2.5 py-2 rounded-md text-sm",
    navActive: "text-ccahGreen font-bold",
    navIdle: "text-ink hover:text-ccahGreen",
    navText: "text-ink hover:text-ccahGreen",
    // ink는 라이트에서 거의 검정, 다크에서 거의 흰색으로 뒤집히는 변수라 hover:bg-ink 위에
    // 고정된 하얀 글자(hover:text-white)만 두면 다크모드에서 흰 배경에 흰 글자가 된다 —
    // 다크모드에서는 반대로(검정) 보이게 별도 지정한다.
    authBtn: "rounded-none border-2 border-ink hover:bg-ink hover:text-white dark:hover:text-black",
    adminLogoutBtn: "rounded-none border-2 border-ink hover:bg-ink hover:text-white dark:hover:text-black",
    iconBtnHover: "hover:bg-ccahGreenLight",
    mobileBorder: "border-t-2 border-ink",
    profileTrigger: "rounded-none border-2 border-ink hover:bg-ink hover:text-white dark:hover:text-black",
    profileDropdown: "bg-surface border-2 border-ink rounded-none shadow-lg",
    profileDropdownItem: "text-ink hover:bg-ccahGreenLight",
    profileDropdownDanger: "text-red hover:bg-ccahGreenLight",

    // footerBg는 ink를 "글자색"이 아니라 일부러 어두운 장식용 배경으로 쓰는 자리라(헤더/
    // 히어로와 달리 다크모드에서도 계속 어두워야 함) ink 변수가 다크모드에서 밝은색으로
    // 뒤집혀도 이 배경만은 원래 라이트 모드 ink 값(#111111)으로 고정해둔다.
    footerBg: "bg-ink dark:bg-[#111111]",
    footerText: "text-white/60",
    footerBorder: "border-t-2 border-ccahGreen",

    // ink는 다크모드에서 밝은색으로 뒤집히지만, 여기선 일부러 어두운 장식 배경으로 쓰는
    // 자리라(footerBg와 같은 이유) 원래 라이트 모드 값으로 고정해둔다.
    heroCard: "bg-ink dark:bg-[#111111] border-l-8 border-ccahGreen text-white px-8 py-10 mb-5",
    heroEyebrow: "text-xs font-bold tracking-widest uppercase mb-1 text-ccahGreenBright",
    heroEyebrowText: "STUDENT SELF-GOVERNANCE",
    heroTitleText: "학생이 만드는 학교, 학생자치회",
    heroHeadingClass: "text-3xl mb-2.5 font-jua",
    heroSubtitleText: "공지·일정·소식을 한눈에 확인하고 여러분의 목소리를 Q&A로 전해주세요.",
    heroSubtextClass: "text-[#D7DEEC] mb-4",
    heroPrimaryBtn: "bg-ccahGreen text-white font-bold text-sm px-[18px] py-2.5",
    heroSecondaryBtn: "border-2 border-white text-white font-bold text-sm px-[18px] py-2.5",

    cardShape: "bg-surface border-2 border-ink rounded-none",
    sectionEyebrow: "text-xs font-bold tracking-widest uppercase mb-1 text-ccahGreen",
    sectionHeadingClass: "text-[22px] font-jua",
    sectionAccentBar: "block",
    sectionAccentColor: "text-ccahGreen",
    sectionMoreBtn: "text-blue font-semibold text-sm",

    streakCard: "bg-surface border-2 border-ink rounded-none px-4 py-3 mb-5",
    streakEmoji: "🔥 ",
    streakBadge: "bg-transparent text-teal font-bold text-sm px-0 py-0",
    streakBadgeDot: "hidden",
    streakCheckmark: " ✓",

    noticeHover: "hover:bg-ccahGreenLight",
    eventDateBg: "bg-ink dark:bg-[#111111]",
    newsHoverBorder: "hover:border-ccahGreen",
    quickTile: "border border-ink hover:bg-ccahGreen hover:text-white px-2 py-4",
    quickShowIcon: true,

    emptyStateWrap: "text-muted text-center py-6 text-sm w-full",
    emptyStateIconWrap: "hidden",
    emptyStateTitle: "",
    emptyStateDesc: "hidden",

    adminHeaderMuted: "text-ink/60",
    adminNavActive: "bg-ink dark:bg-[#111111] text-white font-bold",
    adminNavIdle: "text-ink hover:bg-ccahGreenLight",
    adminAsideBorder: "border-ink",
    adminNavIndicator: "hidden",

    dashStatCard: "bg-surface border-2 border-ink rounded-none p-6",
    dashStatCardWarn: "bg-surface border-2 border-ccahGreen rounded-none p-6",
    dashStatIconBg: "bg-ccahGreenLight rounded-none p-2",
    dashStatValue: "text-ink",
    dashStatValueWarn: "text-ccahGreen",
    dashActionPrimary: "bg-ccahGreen text-white font-bold text-sm px-5 py-3",
    dashActionSecondary: "border-2 border-ink text-ink font-bold text-sm px-5 py-3 bg-surface",
    dashActivityCard: "bg-surface border-2 border-ink rounded-none p-6",
    dashActivityTagNotice: "bg-ccahGreenLight text-ccahGreen",
    dashActivityTagNews: "bg-ink dark:bg-[#111111] text-white",
    dashActivityViewAllBtn: "border-2 border-ink text-ink text-sm font-bold px-3 py-1.5 bg-surface",

    adminBtnPrimary: "bg-ccahGreen text-white font-bold text-sm px-4 py-2",
    adminBtnSecondary: "border-2 border-ink text-ink font-bold text-sm px-4 py-2 bg-surface",
    adminBtnDanger: "text-red text-xs font-bold",
    adminToggleActive: "bg-ink dark:bg-[#111111] text-white border-ink",
    adminToggleIdle: "border-ink",
    adminInput: "border-2 border-ink rounded-none px-2.5 py-2 text-sm",
    adminTableHeaderCell: "text-left text-xs text-ink/60 font-bold border-b-2 border-ink p-2",
    adminTableRowHover: "hover:bg-ccahGreenLight",
    adminTableRowActive: "bg-ccahGreenLight",
    adminTableCell: "p-2.5 border-b border-ink text-sm",
    adminEditPanel: "bg-surface border-2 border-ink rounded-none p-[18px]",
  },
  /** Figma "CCA-Hompage"(https://figma.com/design/pFbmBXTCxTyhTBLFZ9VCUe) 재현 — Apple 느낌의
   * 미니멀한 화이트/블루 톤. 색상·도형·타이포를 실제 디자인 값 그대로 옮겼다(단, 존재하지
   * 않는 링크를 새로 만들지는 않아서 푸터는 기존처럼 한 줄 카피만 유지). */
  apple: {
    headerBg: "bg-surface",
    headerText: "text-appleInk",
    headerBorder: "border-b border-appleBorder",
    logoFont: "",
    navShape: "px-3 py-2 rounded-full text-[15px]",
    navActive: "text-appleInk font-bold",
    navIdle: "text-appleMuted hover:text-appleInk",
    navText: "text-appleMuted hover:text-appleInk",
    authBtn: "rounded-full border border-appleBorder bg-surface hover:bg-appleBg",
    adminLogoutBtn: "rounded-lg border border-[#d9d9d9] bg-[#f2f2f2] text-[#4d4d4d] hover:bg-appleBg dark:bg-appleBg dark:border-appleBorder dark:text-appleInk",
    iconBtnHover: "hover:bg-appleBg",
    mobileBorder: "border-t border-appleBorder",
    profileTrigger: "rounded-full border border-appleBorder bg-surface hover:bg-appleBg",
    profileDropdown: "bg-surface border border-appleBorder rounded-2xl shadow-lg",
    profileDropdownItem: "text-appleInk hover:bg-appleBg",
    profileDropdownDanger: "text-red hover:bg-appleBg",

    footerBg: "bg-surface",
    footerText: "text-appleMuted",
    footerBorder: "border-t border-appleBorder",

    heroCard:
      "bg-surface text-appleInk p-9 md:p-[72px] rounded-[28px] shadow-[0_18px_20px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.04)] mb-5",
    heroEyebrow:
      "inline-block bg-appleBlue text-white text-xs font-bold uppercase tracking-wide rounded-full px-2.5 py-1.5 mb-3",
    heroEyebrowText: "2026 CCHS Student Council",
    heroTitleText: "CCHS 학생자치회",
    heroHeadingClass:
      "font-caveat font-bold text-appleInk text-[42px] md:text-[56px] leading-[1.1] tracking-tight [word-spacing:0.2em] mb-2",
    heroSubtitleText: "2026 중앙기독고등학교 자치회가 전하는 학교 소식, 그리고 소통",
    heroSubtextClass: "text-appleMuted text-lg mb-4",
    heroPrimaryBtn:
      "bg-appleBlue text-white font-bold text-sm rounded-full px-5 py-3 shadow-[0_10px_12px_rgba(37,99,235,0.15)]",
    heroSecondaryBtn: "border border-appleBlue text-appleBlue font-bold text-sm rounded-full px-5 py-3 bg-surface",

    cardShape: "bg-surface rounded-[24px] shadow-[0_2px_5px_rgba(0,0,0,0.04)]",
    sectionEyebrow: "text-appleMuted text-xs font-medium uppercase tracking-wide mb-1",
    sectionHeadingClass: "text-[18px] font-bold text-appleBlue tracking-tight",
    sectionAccentBar: "hidden",
    sectionAccentColor: "text-appleBlue",
    sectionMoreBtn:
      "inline-flex items-center gap-1 rounded-full border border-appleBorder bg-surface text-appleInk text-[13px] font-medium px-3 py-1.5",

    streakCard: "bg-surface rounded-3xl shadow-[0_2px_5px_rgba(0,0,0,0.04)] px-6 py-4 mb-5",
    streakEmoji: "",
    streakBadge:
      "bg-appleBlue/10 border border-appleBlue text-appleBlue font-bold text-[13px] rounded-full px-4 py-2 flex items-center gap-1.5",
    streakBadgeDot: "inline-block w-2 h-2 rounded-full bg-appleBlue",
    streakCheckmark: "",

    noticeHover: "hover:bg-appleBg",
    // appleInk는 다크모드에서 밝은색으로 뒤집혀서(본문 텍스트 역할) 흰 글자와 짝지어 쓰는
    // 이 날짜 배지에서는 대비가 깨진다 — 원래 라이트 모드 값으로 고정해둔다.
    eventDateBg: "bg-appleInk dark:bg-[#111827] rounded-lg",
    newsHoverBorder: "hover:shadow-[0_2px_5px_rgba(0,0,0,0.08)]",
    quickTile: "bg-surface border border-appleBorder rounded-[20px] hover:shadow-sm p-5",
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

    dashStatCard: "bg-surface border border-appleBorder rounded-[20px] p-6 shadow-[0_2px_4px_rgba(0,0,0,0.04)]",
    dashStatCardWarn: "bg-surface border-[1.5px] border-appleAmber rounded-[20px] p-6 shadow-[0_2px_4px_rgba(0,0,0,0.04)]",
    dashStatIconBg: "bg-appleBg rounded-full p-2",
    dashStatValue: "text-appleInk",
    dashStatValueWarn: "text-appleAmber",
    dashActionPrimary: "bg-appleBlue text-white font-bold text-sm rounded-full px-5 py-3 shadow-[0_4px_6px_rgba(37,99,235,0.15)]",
    dashActionSecondary: "border border-appleBorder text-appleInk font-bold text-sm rounded-full px-5 py-3 bg-surface",
    dashActivityCard: "bg-surface border border-appleBorder rounded-3xl p-6 shadow-[0_2px_4px_rgba(0,0,0,0.04)]",
    dashActivityTagNotice: "bg-appleBlue/[0.07] text-appleBlue",
    dashActivityTagNews: "bg-[#ecfdf5] dark:bg-white/10 text-appleGreen",
    dashActivityViewAllBtn: "border border-appleBlue text-appleInk text-sm font-bold rounded-full px-3 py-1.5 bg-[#f9fafb] dark:bg-white/10",

    adminBtnPrimary: "bg-appleBlue text-white font-bold text-sm rounded-lg px-4 py-2 hover:opacity-90",
    adminBtnSecondary: "border border-appleBorder text-appleInk font-bold text-sm rounded-lg px-4 py-2 bg-surface hover:bg-appleBg",
    adminBtnDanger: "text-red text-xs font-bold hover:opacity-70",
    adminToggleActive: "bg-appleBlue text-white border-appleBlue",
    adminToggleIdle: "border-appleBorder text-appleInk",
    adminInput: "border border-appleBorder rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-appleBlue/20",
    adminTableHeaderCell: "text-left text-xs text-appleMuted font-bold uppercase tracking-wide border-b border-appleBorder p-2",
    adminTableRowHover: "hover:bg-appleBg",
    adminTableRowActive: "bg-appleBlue/[0.07]",
    adminTableCell: "p-2.5 border-b border-appleBorder text-sm",
    adminEditPanel: "bg-surface border border-appleBorder rounded-2xl p-[18px] shadow-[0_2px_5px_rgba(0,0,0,0.04)]",
  },
} as const;

export type HomeThemeKey = keyof typeof homeThemeStyles;

/** 관리자 화면(/admin/theme)의 선택지 이름표 */
export const THEME_LABELS: Record<HomeThemeKey, { label: string; description: string }> = {
  classic: { label: "클래식", description: "원래 있던 navy/blue/gold 톤, 둥근 카드" },
  green: { label: "그린 브루탈리즘", description: "검정+초록(#1D6F42), 굵은 테두리, Jua 폰트" },
  apple: { label: "애플 스타일", description: "화이트+블루(#2563eb), 부드러운 그림자, Caveat 손글씨 제목" },
};

/** DB(site_theme)에 아직 행이 없거나 값을 못 읽어왔을 때 쓰는 기본값 */
export const DEFAULT_HOME_THEME: HomeThemeKey = "classic";

export function isHomeThemeKey(value: string): value is HomeThemeKey {
  return value in homeThemeStyles;
}
