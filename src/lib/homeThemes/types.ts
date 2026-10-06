/**
 * 테마 하나가 가져야 하는 스타일 토큰의 형태. classic.ts/green.ts/apple.ts 등
 * 테마별 파일이 전부 이 타입을 따르고, homeTheme.ts가 이들을 모아 homeThemeStyles로
 * 합친다. 필드 목록 자체는 원래 homeTheme.ts에 있던 걸 그대로 옮긴 것뿐이다.
 */
export interface HomeThemeStyle {
  headerBg: string;
  headerText: string;
  headerBorder: string;
  logoFont: string;
  navShape: string;
  navActive: string;
  navIdle: string;
  navText: string;
  authBtn: string;
  adminLogoutBtn: string;
  iconBtnHover: string;
  mobileBorder: string;
  profileTrigger: string;
  profileDropdown: string;
  profileDropdownItem: string;
  profileDropdownDanger: string;

  footerBg: string;
  footerText: string;
  footerBorder: string;

  heroCard: string;
  heroEyebrow: string;
  heroEyebrowText: string;
  heroTitleText: string;
  heroHeadingClass: string;
  heroSubtitleText: string;
  heroSubtextClass: string;
  heroPrimaryBtn: string;
  heroSecondaryBtn: string;

  cardShape: string;
  sectionEyebrow: string;
  sectionHeadingClass: string;
  sectionAccentBar: string;
  sectionAccentColor: string;
  sectionMoreBtn: string;

  streakCard: string;
  streakEmoji: string;
  streakBadge: string;
  streakBadgeDot: string;
  streakCheckmark: string;

  noticeHover: string;
  eventDateBg: string;
  newsHoverBorder: string;
  quickTile: string;
  quickShowIcon: boolean;

  emptyStateWrap: string;
  emptyStateIconWrap: string;
  emptyStateTitle: string;
  emptyStateDesc: string;

  adminHeaderMuted: string;
  adminNavActive: string;
  adminNavIdle: string;
  adminAsideBorder: string;
  adminNavIndicator: string;

  dashStatCard: string;
  dashStatCardWarn: string;
  dashStatIconBg: string;
  dashStatValue: string;
  dashStatValueWarn: string;
  dashActionPrimary: string;
  dashActionSecondary: string;
  dashActivityCard: string;
  dashActivityTagNotice: string;
  dashActivityTagNews: string;
  dashActivityViewAllBtn: string;

  /** 목록형 관리자 화면(공지/뉴스/일정/게시판/Q&A/구성원 등) 공용 토큰 */
  adminBtnPrimary: string;
  adminBtnSecondary: string;
  adminBtnDanger: string;
  adminToggleActive: string;
  adminToggleIdle: string;
  adminInput: string;
  adminTableHeaderCell: string;
  adminTableRowHover: string;
  adminTableRowActive: string;
  adminTableCell: string;
  adminEditPanel: string;
}
