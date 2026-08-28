"use client";

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

  const isAdmin = profile && ["editor", "admin", "superadmin"].includes(profile.role);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <>
    <header className="sticky top-0 z-20 bg-navy text-white">
      <div className="max-w-[1180px] mx-auto flex items-center gap-6 px-5 py-3 flex-wrap">
        <Link href="/" className="font-bold text-lg flex items-center gap-2 shrink-0">
  <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white" />
  학생자치회
</Link>
        <nav className="flex gap-1 flex-wrap flex-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
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
              className={`px-2.5 py-2 rounded-md text-sm ${
                pathname === `/pages/${p.slug}` ? "bg-white/15 text-white" : "text-[#C9D2E3] hover:bg-white/10 hover:text-white"
              }`}
            >
              {p.title}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {profile ? (
            <>
              <Link href="/mypage" className="text-sm text-[#C9D2E3] hover:text-white font-semibold">
                마이페이지
              </Link>
              {isAdmin && (
                <Link href="/admin" className="text-sm px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10">
                  관리자
                </Link>
              )}
              <button onClick={signOut} className="text-sm px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10">
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
    {toast !== null && <CheckInToast streak={toast} />}
    {celebrate && <BadgeCelebration badge={celebrate} onClose={dismissCelebrate} />}
    </>
  );
}
