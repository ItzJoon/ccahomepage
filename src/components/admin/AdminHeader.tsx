"use client";

import Link from "next/link";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { Profile } from "@/lib/types";

export default function AdminHeader({ profile }: { profile: Profile }) {
  const { t } = useHomeTheme();
  return (
    <header className={`sticky top-0 z-20 ${t.headerBg} ${t.headerText} ${t.headerBorder}`}>
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
        <Link href="/admin" className={`font-bold text-lg flex items-center gap-2 shrink-0 ${t.logoFont}`}>
          <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
          <span className="whitespace-nowrap">학생자치회 관리자</span>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs truncate max-w-[200px] ${t.adminHeaderMuted}`}>
            {profile.nickname || profile.name || profile.email} · {profile.role}
          </span>
          <Link href="/" className={`text-sm px-3 py-1.5 shrink-0 whitespace-nowrap ${t.authBtn}`}>
            홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </header>
  );
}
