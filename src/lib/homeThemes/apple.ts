import type { HomeThemeStyle } from "./types";

/** Figma "CCA-Hompage"(https://figma.com/design/pFbmBXTCxTyhTBLFZ9VCUe) 재현 — Apple 느낌의
 * 미니멀한 화이트/블루 톤. 색상·도형·타이포를 실제 디자인 값 그대로 옮겼다(단, 존재하지
 * 않는 링크를 새로 만들지는 않아서 푸터는 기존처럼 한 줄 카피만 유지). */
export const appleTheme: HomeThemeStyle = {
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
  adminBtnDanger: "text-red text-xs font-bold hover:opacity-70 px-1.5 py-2 -mx-1.5 -my-2",
  adminToggleActive: "bg-appleBlue text-white border-appleBlue",
  adminToggleIdle: "border-appleBorder text-appleInk",
  adminInput: "border border-appleBorder rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-appleBlue/20",
  adminTableHeaderCell: "text-left text-xs text-appleMuted font-bold uppercase tracking-wide border-b border-appleBorder p-2",
  adminTableRowHover: "hover:bg-appleBg",
  adminTableRowActive: "bg-appleBlue/[0.07]",
  adminTableCell: "p-2.5 border-b border-appleBorder text-sm",
  adminEditPanel: "bg-surface border border-appleBorder rounded-2xl p-[18px] shadow-[0_2px_5px_rgba(0,0,0,0.04)]",
};
