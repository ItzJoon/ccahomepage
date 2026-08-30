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
  { href: "/admin/board", label: "게시판 관리" },
  { href: "/admin/notify", label: "알림 발송" },
  { href: "/admin/main-editor", label: "메인화면 편집" },
  { href: "/admin/pages", label: "페이지/메뉴 빌더" },
];

// 사이트 전체에 영향을 주거나 민감한 개인정보를 다루는 메뉴라 admin이 아니라 superadmin만
// 볼 수 있어야 한다(직접 URL 접근은 middleware.ts에서 별도로 막는다). 다른 메뉴들과
// 섞이지 않도록 탭 목록 제일 아래에 별도 그룹으로 모아서 보여준다.
const SUPERADMIN_NAV = [
  { href: "/admin/badges", label: "뱃지 관리" },
  { href: "/admin/users", label: "회원·권한 관리" },
  { href: "/admin/access-requests", label: "외부 계정 관리" },
  { href: "/admin/stats", label: "접속 통계" },
  { href: "/admin/maintenance", label: "사이트 잠금" },
  { href: "/admin/activity-logs", label: "활동 로그" },
  { href: "/admin/feature-flags", label: "기능 스위치" },
];

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
  // sub_editor는 /admin/org-activities/*, teacher는 /admin/notices 외에는 middleware가
  // 접근 자체를 막으므로, 눌러도 튕겨나가기만 하는 다른 메뉴들은 아예 보여주지 않는다.
  const isSubEditor = role === "sub_editor";
  const isTeacher = role === "teacher";
  if (isTeacher) {
    return (
      <aside className={`w-[190px] bg-white border-r ${t.adminAsideBorder} p-2.5 flex flex-col gap-0.5 shrink-0`}>
        <NavLink href="/admin/notices" label="공지사항" active={pathname.startsWith("/admin/notices")} t={t} />
      </aside>
    );
  }
  return (
    <aside className={`w-[190px] bg-white border-r ${t.adminAsideBorder} p-2.5 flex flex-col gap-0.5 shrink-0`}>
      {!isSubEditor && (
        <>
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
          ))}
          <div className={`border-t ${t.adminAsideBorder} my-2`} />
        </>
      )}
      <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">조직 활동 관리</div>
      {ORG_ACTIVITIES_NAV.map((n) => (
        <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
      ))}
      {role === "superadmin" && (
        <>
          <div className={`border-t ${t.adminAsideBorder} my-2`} />
          <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">관리자 전용</div>
          {SUPERADMIN_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
          ))}
          <NavLink href="/admin/theme" label="테마" active={pathname === "/admin/theme"} t={t} />
        </>
      )}
    </aside>
  );
}
