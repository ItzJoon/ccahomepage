"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

// 기존 메뉴들과 섞이지 않도록 구분선 아래에 별도 그룹으로 묶어서 보여준다.
const ORG_ACTIVITIES_NAV = [
  { href: "/admin/org-activities/proposals", label: "안건함" },
  { href: "/admin/org-activities/events", label: "조직 일정" },
  { href: "/admin/org-activities/records", label: "활동기록" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`text-left px-3 py-2.5 rounded-lg text-sm ${
        active ? "bg-navy text-white font-bold" : "text-navy hover:bg-[#F2F4F8]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="w-[190px] bg-white border-r border-border p-2.5 flex flex-col gap-0.5 shrink-0">
      {NAV.map((n) => (
        <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} />
      ))}

      <div className="border-t border-border my-2" />
      <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">조직 활동 관리</div>
      {ORG_ACTIVITIES_NAV.map((n) => (
        <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} />
      ))}
    </aside>
  );
}
