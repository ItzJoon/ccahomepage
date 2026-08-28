"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAutoCheckIn } from "@/hooks/useAutoCheckIn";
import CheckInToast from "@/components/CheckInToast";
import BadgeCelebration from "@/components/BadgeCelebration";
import type { PageDoc, Profile } from "@/lib/types";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/notices", label: "공지사항" },
  { href: "/organizations", label: "학생자치회 소개" },
  { href: "/members", label: "구성원" },
  { href: "/calendar", label: "일정" },
  { href: "/news", label: "뉴스" },
  { href: "/rules", label: "생활규정" },
  { href: "/qna", label: "Q&A" },
];

export default function Header({
  profile,
  customPages,
}: {
  profile: Profile | null;
  customPages: PageDoc[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { toast, celebrate, dismissCelebrate } = useAutoCheckIn(profile?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = profile && ["editor", "admin", "superadmin"].includes(profile.role);

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
    <header className="sticky top-0 z-20 bg-navy text-white">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="font-bold text-lg flex items-center gap-2 shrink-0" onClick={closeMobile}>
          <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
          <span className="whitespace-nowrap">학생자치회</span>
        </Link>

        <nav className="hidden md:flex gap-1 flex-wrap flex-1 min-w-0">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-2.5 py-2 rounded-md text-sm whitespace-nowrap ${
                pathname === n.href ? "bg-white/15 text-white" : "text-[#C9D2E3] hover:bg-white/10 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {customPages.map((p) => (
            <Link
              key={p.id}
              href={`/pages/${p.slug}`}
              className={`px-2.5 py-2 rounded-md text-sm whitespace-nowrap ${
                pathname === `/pages/${p.slug}` ? "bg-white/15 text-white" : "text-[#C9D2E3] hover:bg-white/10 hover:text-white"
              }`}
            >
              {p.title}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          {profile ? (
            <>
              <Link href="/mypage" className="text-sm text-[#C9D2E3] hover:text-white font-semibold whitespace-nowrap">
                마이페이지
              </Link>
              {isAdmin && (
                <Link href="/admin" className="text-sm px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10 whitespace-nowrap">
                  관리자
                </Link>
              )}
              <button onClick={signOut} className="text-sm px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10 whitespace-nowrap">
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10 whitespace-nowrap">
              로그인
            </Link>
          )}
        </div>

        <button
          type="button"
          className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-md hover:bg-white/10 text-xl leading-none"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-5 py-3">
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={closeMobile}
                className={`px-2.5 py-2 rounded-md text-sm ${
                  pathname === n.href ? "bg-white/15 text-white" : "text-[#C9D2E3] hover:bg-white/10 hover:text-white"
                }`}
              >
                {n.label}
              </Link>
            ))}
            {customPages.map((p) => (
              <Link
                key={p.id}
                href={`/pages/${p.slug}`}
                onClick={closeMobile}
                className={`px-2.5 py-2 rounded-md text-sm ${
                  pathname === `/pages/${p.slug}` ? "bg-white/15 text-white" : "text-[#C9D2E3] hover:bg-white/10 hover:text-white"
                }`}
              >
                {p.title}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-white/10">
            {profile ? (
              <>
                <Link href="/mypage" onClick={closeMobile} className="px-2.5 py-2 rounded-md text-sm text-[#C9D2E3] hover:bg-white/10 hover:text-white font-semibold">
                  마이페이지
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={closeMobile} className="px-2.5 py-2 rounded-md text-sm text-[#C9D2E3] hover:bg-white/10 hover:text-white">
                    관리자
                  </Link>
                )}
                <button
                  onClick={() => {
                    closeMobile();
                    signOut();
                  }}
                  className="px-2.5 py-2 rounded-md text-sm text-left text-[#C9D2E3] hover:bg-white/10 hover:text-white"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link href="/login" onClick={closeMobile} className="px-2.5 py-2 rounded-md text-sm text-[#C9D2E3] hover:bg-white/10 hover:text-white">
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
