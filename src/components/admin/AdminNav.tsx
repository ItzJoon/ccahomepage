"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { homeThemeStyles, HomeThemeKey } from "@/lib/homeTheme";

type Theme = (typeof homeThemeStyles)[keyof typeof homeThemeStyles];

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/notices", label: "공지사항" },
  { href: "/admin/news", label: "뉴스" },
  { href: "/admin/events", label: "일정" },
  { href: "/admin/organizations", label: "조직 관리" },
  { href: "/admin/members", label: "구성원 관리" },
  { href: "/admin/rules", label: "규정 관리" },
  { href: "/admin/qna", label: "Q&A 관리" },
  { href: "/admin/notify", label: "알림 발송" },
  { href: "/admin/main-editor", label: "메인화면 편집" },
  { href: "/admin/badges", label: "뱃지 관리" },
  { href: "/admin/pages", label: "페이지/메뉴 빌더" },
  { href: "/admin/users", label: "회원·권한 관리" },
  { href: "/admin/access-requests", label: "외부 계정 관리" },
  { href: "/admin/stats", label: "접속 통계" },
  { href: "/admin/maintenance", label: "사이트 잠금" },
];

// 사이트 전체에 영향을 주거나 민감한 개인정보를 다루는 메뉴라 admin이 아니라 superadmin만
// 볼 수 있어야 한다(직접 URL 접근은 middleware.ts에서 별도로 막는다).
const SUPERADMIN_ONLY_HREFS = new Set([
  "/admin/badges",
  "/admin/users",
  "/admin/access-requests",
  "/admin/stats",
  "/admin/maintenance",
]);

// 기존 메뉴들과 섞이지 않도록 구분선 아래에 별도 그룹으로 묶어서 보여준다.
const ORG_ACTIVITIES_NAV = [
  { href: "/admin/org-activities/proposals", label: "안건함" },
  { href: "/admin/org-activities/events", label: "조직 일정" },
  { href: "/admin/org-activities/records", label: "활동기록" },
];

function NavLink({ href, label, active, t }: { href: string; label: string; active: boolean; t: Theme }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm ${active ? t.adminNavActive : t.adminNavIdle}`}
    >
      <span className="flex-1">{label}</span>
      {active && <span className={t.adminNavIndicator} />}
    </Link>
  );
}

export default function AdminNav({ role, initialThemeKey }: { role?: string; initialThemeKey?: HomeThemeKey }) {
  const pathname = usePathname();
  const { t } = useHomeTheme(initialThemeKey);
  // sub_editor는 middleware에서 /admin/org-activities/* 외 다른 관리 화면 접근 자체가
  // 막혀 있으므로, 눌러도 튕겨나가기만 하는 다른 메뉴들은 아예 보여주지 않는다.
  const isSubEditor = role === "sub_editor";
  return (
    <aside className={`w-[190px] bg-white border-r ${t.adminAsideBorder} p-2.5 flex flex-col gap-0.5 shrink-0`}>
      {!isSubEditor && (
        <>
          {NAV.filter((n) => role === "superadmin" || !SUPERADMIN_ONLY_HREFS.has(n.href)).map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
          ))}
          {/* 사이트 전체 디자인을 바꾸는 기능이라 superadmin에게만 메뉴 자체를 보여준다 */}
          {role === "superadmin" && (
            <NavLink href="/admin/theme" label="테마" active={pathname === "/admin/theme"} t={t} />
          )}
          <div className={`border-t ${t.adminAsideBorder} my-2`} />
        </>
      )}
      <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">조직 활동 관리</div>
      {ORG_ACTIVITIES_NAV.map((n) => (
        <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
      ))}
    </aside>
  );
}
