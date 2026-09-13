"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAutoCheckIn } from "@/hooks/useAutoCheckIn";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import CheckInToast from "@/components/CheckInToast";
import BadgeCelebration from "@/components/BadgeCelebration";
import FreezeChoiceModal from "@/components/FreezeChoiceModal";
import ProfileQuickEditModal from "@/components/ProfileQuickEditModal";
import NotificationCenter from "@/components/NotificationCenter";
import ThemeMenuSection from "@/components/ThemeMenuSection";
import type { HomeThemeKey } from "@/lib/homeTheme";
import type { PageDoc, Profile } from "@/lib/types";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/notices", label: "공지사항", flagKey: "notices" },
  { href: "/organizations", label: "학생자치회 소개", flagKey: "organizations" },
  { href: "/members", label: "구성원", flagKey: "members" },
  { href: "/rankings", label: "랭킹" },
  { href: "/calendar", label: "일정", flagKey: "calendar" },
  { href: "/news", label: "뉴스", flagKey: "news" },
  { href: "/rules", label: "생활규정", flagKey: "rules" },
  { href: "/qna", label: "Q&A", flagKey: "qna" },
  { href: "/board", label: "게시판", flagKey: "board" },
  { href: "/patch-notes", label: "패치노트" },
];

// 모바일(640px 미만) 화면 하단 고정 탭바에 들어가는 항목 — 학생들이 가장 자주 쓸 만한
// 메뉴만 추려서 항상 한 번에 누를 수 있게 하고, 나머지는 "더보기"(모바일 헤더 메뉴)로
// 뺀다. 마이페이지는 NAV 배열이 아니라 프로필 유무에 따라 로그인/마이페이지로 갈리므로
// 여기서 별도로 다룬다(아래 mobileBottomTabs 계산부 참고).
const BOTTOM_TAB_HREFS = new Set(["/", "/notices", "/qna", "/board"]);
const BOTTOM_TABS: { href: string; label: string; icon: string; flagKey?: string; match: (p: string) => boolean }[] = [
  { href: "/", label: "홈", icon: "🏠", match: (p) => p === "/" },
  { href: "/notices", label: "공지사항", icon: "📢", flagKey: "notices", match: (p) => p.startsWith("/notices") },
  { href: "/qna", label: "Q&A", icon: "💬", flagKey: "qna", match: (p) => p.startsWith("/qna") },
  { href: "/board", label: "게시판", icon: "📝", flagKey: "board", match: (p) => p.startsWith("/board") },
];

export default function Header({
  profile,
  customPages,
  checkInEligible = true,
  initialThemeKey,
  disabledFeatures,
}: {
  profile: Profile | null;
  customPages: PageDoc[];
  checkInEligible?: boolean;
  initialThemeKey?: HomeThemeKey;
  disabledFeatures?: Set<string>;
}) {
  // superadmin이 /admin/feature-flags에서 끈 메뉴는 학생 화면 내비게이션에서도 숨긴다
  // (URL 직접 접근은 middleware.ts가 별도로 막는다).
  const visibleNav = NAV.filter((n) => !n.flagKey || !disabledFeatures?.has(n.flagKey));
  // 모바일 헤더의 "더보기" 목록 — 하단 탭바에 이미 있는 항목(홈/공지사항/Q&A/게시판)은
  // 중복이라 빼고, 나머지(학생자치회 소개/구성원/랭킹/일정/뉴스/생활규정/패치노트)만 남긴다.
  const moreNav = visibleNav.filter((n) => !BOTTOM_TAB_HREFS.has(n.href));
  const visibleBottomTabs = BOTTOM_TABS.filter((n) => !n.flagKey || !disabledFeatures?.has(n.flagKey));
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useHomeTheme(initialThemeKey);
  // hasAdminRole: 실제 관리자 화면 전체(대시보드 포함)에 들어갈 수 있는 role인지 —
  // designer(조회 전용)도 관리 화면에 들어갈 수 있어야 하므로 함께 포함한다.
  const hasAdminRole = !!profile && ["editor", "admin", "superadmin", "designer"].includes(profile.role);
  // is_council/is_judiciary만 있고 별도 관리자 role이 없는 학생/교사도 이 버튼을 볼 수
  // 있어야 한다 — 다만 이런 계정은 /admin 전체가 아니라 자기 부서 활동(안건함/부서 일정/
  // 활동기록) 또는 사법위원회 전용 화면(둘은 완전히 별개의 데이터)만 다룰 수 있으므로
  // /admin이 아니라 바로 그 화면으로 보낸다. 이미 관리자 role이 있는 사람은 원래대로
  // /admin(대시보드)로 보낸다 — 거기서 임원회/사법위원회 전용 탭도 함께 보인다.
  const showAdminBtn = hasAdminRole || !!profile?.is_council || !!profile?.is_judiciary;
  const adminHref = hasAdminRole
    ? "/admin"
    : profile?.is_council
    ? "/admin/org-activities"
    : "/admin/judiciary-activities";
  // admin 권한(editor 이상) 없이 is_council/is_judiciary만으로 들어가는 계정은 "관리자"가
  // 아니라 소속에 맞는 이름("임원회"/"사법위원회")으로 표시한다 — 실제로 갈 수 있는 곳도
  // 전체 관리자 화면이 아니라 그 활동 관리뿐이라, 버튼 이름부터 그 사실과 맞게 보여준다.
  const adminBtnLabel = hasAdminRole ? "관리자" : profile?.is_council ? "임원회" : "사법위원회";
  // 사이트 잠금 모드는 admin/superadmin/viewer/designer가 우회하므로(middleware.ts와 동일
  // 기준, editor는 예외 아님), 연속 접속 체크인도 같은 기준으로 잠금 중 보류 여부를 판단한다.
  const isLockdownExempt = !!profile && ["admin", "superadmin", "viewer", "designer"].includes(profile.role);
  const { toast, celebrate, dismissCelebrate, freezePrompt, resolveFreezePrompt } = useAutoCheckIn(
    profile?.id ?? null,
    isLockdownExempt,
    checkInEligible
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const closeMobile = () => setMobileOpen(false);

  const submitSearch = () => {
    if (!searchQuery.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchOpen(false);
    setSearchQuery("");
    closeMobile();
  };

  useEffect(() => {
    setMobileOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  // 드롭다운 바깥을 클릭하면 닫히게 한다.
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [profileMenuOpen]);

  const displayName = profile?.nickname || profile?.name || "내 계정";

  return (
    <>
    <header className={`sticky top-0 z-20 ${t.headerBg} ${t.headerText} ${t.headerBorder}`}>
      <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className={`font-bold text-lg flex items-center gap-2 shrink-0 ${t.logoFont}`} onClick={closeMobile}>
          <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-white/90 shrink-0" />
          <span className="whitespace-nowrap">학생자치회</span>
        </Link>

        <nav className="hidden sm:flex gap-1 flex-wrap flex-1 min-w-0">
          {visibleNav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`${t.navShape} whitespace-nowrap ${pathname === n.href ? t.navActive : t.navIdle}`}
            >
              {n.label}
            </Link>
          ))}
          {customPages.map((p) => (
            <Link
              key={p.id}
              href={`/pages/${p.slug}`}
              className={`${t.navShape} whitespace-nowrap ${pathname === `/pages/${p.slug}` ? t.navActive : t.navIdle}`}
            >
              {p.title}
            </Link>
          ))}
        </nav>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {searchOpen ? (
            <input
              autoFocus
              className="w-40 border border-border rounded-md px-2.5 py-1.5 text-sm"
              placeholder="통합 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              onBlur={() => !searchQuery && setSearchOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={`w-11 h-11 flex items-center justify-center rounded-md text-base leading-none ${t.iconBtnHover}`}
              aria-label="통합 검색 열기"
            >
              🔍
            </button>
          )}
          {profile && <NotificationCenter userId={profile.id} />}
          {profile ? (
            <>
              {showAdminBtn && (
                <Link href={adminHref} className={`text-sm px-3 py-1.5 whitespace-nowrap ${t.authBtn}`}>
                  {adminBtnLabel}
                </Link>
              )}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className={`text-sm font-semibold px-3 py-1.5 whitespace-nowrap ${t.profileTrigger}`}
                >
                  {displayName} ▾
                </button>
                {profileMenuOpen && (
                  <div className={`absolute right-0 top-full mt-2 w-48 py-1.5 z-30 ${t.profileDropdown}`}>
                    <Link
                      href="/mypage"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`block px-4 py-2 text-sm ${t.profileDropdownItem}`}
                    >
                      마이페이지
                    </Link>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setQuickEditOpen(true);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${t.profileDropdownItem}`}
                    >
                      닉네임 · 소개 수정
                    </button>
                    <div className="my-1 border-t border-border" />
                    <ThemeMenuSection itemClassName={`w-full text-left px-4 py-2 text-sm ${t.profileDropdownItem}`} />
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={signOut}
                      className={`block w-full text-left px-4 py-2 text-sm ${t.profileDropdownDanger}`}
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" className={`text-sm px-3 py-1.5 whitespace-nowrap ${t.authBtn}`}>
              로그인
            </Link>
          )}
        </div>

        <div className="sm:hidden flex items-center gap-1 shrink-0">
          <button
            type="button"
            className={`w-11 h-11 flex items-center justify-center rounded-md text-xl leading-none ${t.iconBtnHover}`}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "더보기 메뉴 닫기" : "더보기 메뉴 열기"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        // 이 패널은 별도 오버레이가 아니라 헤더(sticky) 안에서 내용만큼 늘어나는
        // 자식이라, 메뉴 항목이 화면 높이보다 짧게 끝나면 그 아래로 실제 페이지
        // 본문(홈 화면 히어로 등)이 그대로 비쳐서 마치 메뉴가 중간에 잘린 것처럼
        // 보였다 — min-h로 항상 화면을 꽉 채우게 해서 어떤 기기에서도 이어지는
        // 배경 없이 끊겨 보이지 않게 한다(배경은 부모 header의 headerBg를 그대로 물려받음).
        <div className={`sm:hidden min-h-[100dvh] ${t.mobileBorder} px-5 py-3`}>
          <div className="flex gap-2 mb-2.5">
            <input
              className="flex-1 border border-border rounded-md px-2.5 py-1.5 text-sm"
              placeholder="통합 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            />
            <button type="button" onClick={submitSearch} className={`text-sm px-3 rounded-md ${t.authBtn}`}>
              검색
            </button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {moreNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={closeMobile}
                className={`px-2.5 py-2 rounded-md text-sm ${pathname === n.href ? t.navActive : t.navIdle}`}
              >
                {n.label}
              </Link>
            ))}
            {customPages.map((p) => (
              <Link
                key={p.id}
                href={`/pages/${p.slug}`}
                onClick={closeMobile}
                className={`px-2.5 py-2 rounded-md text-sm ${pathname === `/pages/${p.slug}` ? t.navActive : t.navIdle}`}
              >
                {p.title}
              </Link>
            ))}
          </nav>
          <div className={`flex flex-col gap-0.5 mt-2 pt-2 ${t.mobileBorder}`}>
            {profile ? (
              <>
                <button
                  onClick={() => {
                    closeMobile();
                    setQuickEditOpen(true);
                  }}
                  className={`px-2.5 py-2 rounded-md text-sm text-left ${t.navIdle}`}
                >
                  닉네임 · 소개 수정
                </button>
                <div className="my-1 border-t border-border" />
                <ThemeMenuSection itemClassName={`px-2.5 py-2 rounded-md text-sm text-left ${t.navIdle}`} />
                <div className="my-1 border-t border-border" />
                {showAdminBtn && (
                  <Link href={adminHref} onClick={closeMobile} className={`px-2.5 py-2 rounded-md text-sm ${t.navIdle}`}>
                    {adminBtnLabel}
                  </Link>
                )}
                <button
                  onClick={() => {
                    closeMobile();
                    signOut();
                  }}
                  className={`px-2.5 py-2 rounded-md text-sm text-left ${t.navIdle}`}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link href="/login" onClick={closeMobile} className={`px-2.5 py-2 rounded-md text-sm ${t.navIdle}`}>
                로그인
              </Link>
            )}
          </div>
        </div>
      )}
    </header>

    {/* 카카오톡/인스타그램처럼 모바일(640px 미만)에서만 화면 하단에 고정되는 탭바 —
        학생들이 가장 자주 쓸 만한 5개(홈/공지사항/Q&A/게시판/마이페이지)만 담고, 나머지는
        위 "더보기"(☰) 메뉴에 그대로 남겨둔다. /admin은 이 Header 자체를 안 쓰고
        AdminHeader+사이드바를 따로 쓰므로 자동으로 적용되지 않는다. 페이지 본문이 이
        아래 가려지지 않도록 (site)/layout.tsx의 <main>에 모바일 전용 하단 여백을
        맞춰뒀다. */}
    <nav
      className={`sm:hidden fixed bottom-0 inset-x-0 z-30 ${t.headerBg} ${t.headerText} ${t.mobileBorder}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {visibleBottomTabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ${
                active ? t.navActive : t.navIdle
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
        <Link
          href={profile ? "/mypage" : "/login"}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ${
            (profile ? pathname.startsWith("/mypage") : pathname === "/login") ? t.navActive : t.navIdle
          }`}
        >
          <span className="text-lg leading-none">👤</span>
          마이페이지
        </Link>
      </div>
    </nav>

    {toast !== null && <CheckInToast streak={toast.streak} streakReset={toast.streakReset} />}
    {freezePrompt && (
      <FreezeChoiceModal
        streak={freezePrompt.streak}
        streakIfUsed={freezePrompt.streakIfUsed}
        freezeCredits={freezePrompt.freezeCredits}
        onUse={() => resolveFreezePrompt(true)}
        onSkip={() => resolveFreezePrompt(false)}
      />
    )}
    {celebrate && (
      <BadgeCelebration badge={celebrate} onClose={dismissCelebrate} soundEnabled={profile?.badge_sound_enabled ?? true} />
    )}
    {quickEditOpen && profile && (
      <ProfileQuickEditModal
        userId={profile.id}
        initialNickname={profile.nickname ?? ""}
        initialBio={profile.bio ?? ""}
        initialProfileImage={profile.profile_image}
        onClose={() => setQuickEditOpen(false)}
      />
    )}
    </>
  );
}
