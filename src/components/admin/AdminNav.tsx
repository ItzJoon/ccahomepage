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
  // 부서 구성원 관리(옛 "/admin/members")는 별도 메뉴로 두지 않고 이 화면 안에 탭으로
  // 통합했다 — 메인 헤더의 "구성원"(학교 전체 명단, /members)과 이름이 겹쳐 헷갈리기 쉬웠음.
  { href: "/admin/organizations", label: "부서 관리" },
  { href: "/admin/rules", label: "규정 관리" },
  { href: "/admin/qna", label: "Q&A 관리" },
  { href: "/admin/board", label: "게시판 관리" },
  { href: "/admin/notify", label: "알림 발송" },
  { href: "/admin/main-editor", label: "메인화면 편집" },
  { href: "/admin/pages", label: "페이지/메뉴 빌더" },
];

// 신고 내역/급식표 관리는 editor(부장급)에게도 보이면 안 되고 admin 이상만 봐야 한다
// — teacher는 물론 editor도 제외. (이메일 발송 이력은 /admin/notify 안에 탭으로 통합됨 —
// teacher/editor도 본인이 보낸 발송 이력은 볼 수 있어야 하므로 여기 목록에 넣지 않는다.)
const ADMIN_ONLY_NAV = [
  { href: "/admin/reports", label: "신고 내역" },
  { href: "/admin/meal-plans", label: "급식표 관리" },
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
// role(sub_editor 이상)과 무관하게 is_council(임원회) 플래그가 있는 사람에게만 보인다.
const ORG_ACTIVITIES_NAV = [
  { href: "/admin/org-activities/proposals", label: "안건함" },
  { href: "/admin/org-activities/events", label: "부서 일정" },
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

export default function AdminNav({
  role,
  isCouncil,
  initialThemeKey,
}: {
  role?: string;
  isCouncil?: boolean;
  initialThemeKey?: HomeThemeKey;
}) {
  const pathname = usePathname();
  const { t } = useHomeTheme(initialThemeKey);
  // sub_editor나 is_council만으로 /admin에 들어온 student/teacher는 /admin/org-activities/*
  // 외에는 middleware가 접근 자체를 막으므로, 눌러도 튕겨나가기만 하는 다른 메뉴들은 아예
  // 보여주지 않는다 — "임원회 전용" 그룹만 보인다. designer(조회 전용)는 "탭 자체는 숨기지
  // 않는다"는 요건이라, 아래 모든 그룹 표시 조건에서 superadmin과 동일하게 취급해 전부
  // 보여준다(실제 조작은 다른 곳에서 DesignerModeGate가 막는다).
  const isDesigner = role === "designer";
  const hasAdminRole = !!role && ["editor", "admin", "superadmin", "designer"].includes(role);
  return (
    <aside className={`w-[190px] bg-white border-r ${t.adminAsideBorder} p-2.5 flex flex-col gap-0.5 shrink-0`}>
      {hasAdminRole && (
        <>
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
          ))}
          <div className={`border-t ${t.adminAsideBorder} my-2`} />
        </>
      )}
      {(isCouncil || role === "superadmin" || isDesigner) && (
        <>
          <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">임원회 전용</div>
          {ORG_ACTIVITIES_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
          ))}
        </>
      )}
      {(role === "admin" || role === "superadmin" || isDesigner) && (
        <>
          <div className={`border-t ${t.adminAsideBorder} my-2`} />
          {ADMIN_ONLY_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} />
          ))}
        </>
      )}
      {(role === "superadmin" || isDesigner) && (
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
