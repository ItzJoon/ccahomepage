"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAutoCheckIn } from "@/hooks/useAutoCheckIn";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import CheckInToast from "@/components/CheckInToast";
import BadgeCelebration from "@/components/BadgeCelebration";
import type { PageDoc, Profile } from "@/lib/types";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/notices", label: "공지사항" },
  { href: "/organizations", label: "학생자치회 소개" },
  { href: "/members", label: "구성원" },
  { href: "/org-activities", label: "조직 활동" },
  { href: "/calendar", label: "일정" },
  { href: "/news", label: "뉴스" },
  { href: "/rules", label: "생활규정" },
  { href: "/qna", label: "Q&A" },
];

export default function Header({
  profile,
  customPages,
  checkInEligible = true,
}: {
  profile: Profile | null;
  customPages: PageDoc[];
  checkInEligible?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useHomeTheme();
  const isAdmin = profile && ["editor", "admin", "superadmin"].includes(profile.role);
  // 사이트 잠금 모드는 admin/superadmin만 우회하므로(editor는 예외 아님), 연속 접속 체크인도
  // 같은 기준으로 잠금 중 보류 여부를 판단한다.
  const isLockdownExempt = !!profile && ["admin", "superadmin"].includes(profile.role);
  const { toast, celebrate, dismissCelebrate } = useAutoCheckIn(profile?.id ?? null, isLockdownExempt, checkInEligible);
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
    <header className={`sticky top-0 z-20 ${t.headerBg} ${t.headerText} ${t.headerBorder}`}>
      <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className={`font-bold text-lg flex items-center gap-2 shrink-0 ${t.logoFont}`} onClick={closeMobile}>
          <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
          <span className="whitespace-nowrap">학생자치회</span>
        </Link>

        <nav className="hidden md:flex gap-1 flex-wrap flex-1 min-w-0">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-2.5 py-2 rounded-md text-sm whitespace-nowrap ${pathname === n.href ? t.navActive : t.navIdle}`}
            >
              {n.label}
            </Link>
          ))}
          {customPages.map((p) => (
            <Link
              key={p.id}
              href={`/pages/${p.slug}`}
              className={`px-2.5 py-2 rounded-md text-sm whitespace-nowrap ${
                pathname === `/pages/${p.slug}` ? t.navActive : t.navIdle
              }`}
            >
              {p.title}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          {profile ? (
            <>
              <Link href="/mypage" className={`text-sm font-semibold whitespace-nowrap ${t.navText}`}>
                마이페이지
              </Link>
              {isAdmin && (
                <Link href="/admin" className={`text-sm px-3 py-1.5 whitespace-nowrap ${t.authBtn}`}>
                  관리자
                </Link>
              )}
              <button onClick={signOut} className={`text-sm px-3 py-1.5 whitespace-nowrap ${t.authBtn}`}>
                로그아웃
              </button>
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
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
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
                {isAdmin && (
                  <Link href="/admin" onClick={closeMobile} className={`px-2.5 py-2 rounded-md text-sm ${t.navIdle}`}>
                    관리자
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
    {toast !== null && <CheckInToast streak={toast} />}
    {celebrate && <BadgeCelebration badge={celebrate} onClose={dismissCelebrate} />}
    </>
  );
}
