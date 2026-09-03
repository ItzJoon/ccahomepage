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
import type { HomeThemeKey } from "@/lib/homeTheme";
import type { PageDoc, Profile } from "@/lib/types";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/notices", label: "공지사항", flagKey: "notices" },
  { href: "/organizations", label: "학생자치회 소개", flagKey: "organizations" },
  { href: "/members", label: "구성원", flagKey: "members" },
  { href: "/calendar", label: "일정", flagKey: "calendar" },
  { href: "/news", label: "뉴스", flagKey: "news" },
  { href: "/rules", label: "생활규정", flagKey: "rules" },
  { href: "/qna", label: "Q&A", flagKey: "qna" },
  { href: "/board", label: "게시판", flagKey: "board" },
  { href: "/patch-notes", label: "패치노트" },
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
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useHomeTheme(initialThemeKey);
  // hasAdminRole: 실제 관리자 화면 전체(대시보드 포함)에 들어갈 수 있는 role인지 —
  // designer(조회 전용)도 관리 화면에 들어갈 수 있어야 하므로 함께 포함한다.
  const hasAdminRole = !!profile && ["editor", "admin", "superadmin", "designer"].includes(profile.role);
  // is_council만 있고 별도 관리자 role이 없는 학생/교사도 "관리자" 버튼을 볼 수 있어야
  // 한다 — 다만 이런 계정은 /admin 전체가 아니라 자기 부서 활동(안건함/부서 일정/활동기록)만
  // 다룰 수 있으므로 /admin이 아니라 바로 그 화면으로 보낸다. 이미 관리자 role이 있는
  // 사람은 원래대로 /admin(대시보드)로 보낸다 — 거기서 임원회 전용 탭도 함께 보인다.
  const showAdminBtn = hasAdminRole || !!profile?.is_council;
  const adminHref = hasAdminRole ? "/admin" : "/admin/org-activities";
  // admin 권한(editor 이상) 없이 is_council만으로 들어가는 계정은 "관리자"가 아니라
  // "임원회"로 표시한다 — 실제로 갈 수 있는 곳도 전체 관리자 화면이 아니라 부서 활동
  // 관리뿐이라, 버튼 이름부터 그 사실과 맞게 보여준다.
  const adminBtnLabel = hasAdminRole ? "관리자" : "임원회";
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
          <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
          <span className="whitespace-nowrap">학생자치회</span>
        </Link>

        <nav className="hidden md:flex gap-1 flex-wrap flex-1 min-w-0">
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

        <div className="hidden md:flex items-center gap-2 shrink-0">
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
              className={`w-9 h-9 flex items-center justify-center rounded-md text-base leading-none ${t.iconBtnHover}`}
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

        <button
          type="button"
          className={`md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-xl leading-none ${t.iconBtnHover}`}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div className={`md:hidden ${t.mobileBorder} px-5 py-3`}>
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
            {visibleNav.map((n) => (
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
                <Link href="/mypage" onClick={closeMobile} className={`px-2.5 py-2 rounded-md text-sm font-semibold ${t.navIdle}`}>
                  마이페이지
                </Link>
                <button
                  onClick={() => {
                    closeMobile();
                    setQuickEditOpen(true);
                  }}
                  className={`px-2.5 py-2 rounded-md text-sm text-left ${t.navIdle}`}
                >
                  닉네임 · 소개 수정
                </button>
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
