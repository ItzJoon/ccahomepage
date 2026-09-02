"use client";

import Link from "next/link";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { HomeThemeKey } from "@/lib/homeTheme";

export default function Footer({ initialThemeKey }: { initialThemeKey?: HomeThemeKey } = {}) {
  const { t } = useHomeTheme(initialThemeKey);
  return (
    <footer className={`${t.footerBg} ${t.footerText} ${t.footerBorder} text-center py-4 text-sm flex flex-col items-center gap-1`}>
      <span>© 학생자치회 · 이 사이트는 관리자 페이지에서 실시간으로 관리됩니다.</span>
      <Link href="/patch-notes" className="underline underline-offset-2 opacity-80 hover:opacity-100">
        패치노트
      </Link>
    </footer>
  );
}
