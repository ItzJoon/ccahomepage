"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { useRealtimeList } from "@/hooks/useRealtimeList";
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
  { href: "/admin/moderation", label: "정지·차단 계정" },
  { href: "/admin/meal-plans", label: "급식표 관리" },
  { href: "/admin/badges", label: "뱃지 관리" },
];

// 사이트 전체에 영향을 주거나 민감한 개인정보를 다루는 메뉴라 admin이 아니라 superadmin만
// 볼 수 있어야 한다(직접 URL 접근은 middleware.ts에서 별도로 막는다). 다른 메뉴들과
// 섞이지 않도록 탭 목록 제일 아래에 별도 그룹으로 모아서 보여준다.
const SUPERADMIN_NAV = [
  { href: "/admin/users", label: "회원·권한 관리" },
  { href: "/admin/access-requests", label: "외부 계정 관리" },
  { href: "/admin/stats", label: "접속 통계" },
  { href: "/admin/maintenance", label: "사이트 잠금" },
  { href: "/admin/activity-logs", label: "활동 로그" },
  { href: "/admin/feature-flags", label: "기능 스위치" },
  { href: "/admin/site-restrictions", label: "사이트 제한" },
  { href: "/admin/patch-notes", label: "패치노트 관리" },
];

// 기존 메뉴들과 섞이지 않도록 구분선 아래에 별도 그룹으로 묶어서 보여준다.
// role(sub_editor 이상)과 무관하게 is_council(임원회) 플래그가 있는 사람에게만 보인다.
const ORG_ACTIVITIES_NAV = [
  { href: "/admin/org-activities/proposals", label: "안건함" },
  { href: "/admin/org-activities/events", label: "부서 일정" },
  { href: "/admin/org-activities/records", label: "활동기록" },
];

// 임원회 전용과 완전히 별개의 데이터(judiciary_* 테이블)를 쓰는 사법위원회 전용 메뉴.
// is_judiciary(사법위원회 소속) 플래그가 있는 사람에게만 보인다 — 임원회 쪽과 데이터도
// 화면도 서로 공유하지 않는다.
const JUDICIARY_ACTIVITIES_NAV = [
  { href: "/admin/judiciary-activities/proposals", label: "안건함" },
  { href: "/admin/judiciary-activities/events", label: "일정" },
  { href: "/admin/judiciary-activities/records", label: "활동기록" },
];

function NavLink({
  href,
  label,
  active,
  t,
  badgeCount,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  t: Theme;
  badgeCount?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm ${active ? t.adminNavActive : t.adminNavIdle}`}
    >
      <span className="flex-1">{label}</span>
      {!!badgeCount && (
        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-bold leading-[18px] text-center">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      {active && <span className={t.adminNavIndicator} />}
    </Link>
  );
}

export default function AdminNav({
  role,
  isCouncil,
  isJudiciary,
  initialThemeKey,
}: {
  role?: string;
  isCouncil?: boolean;
  isJudiciary?: boolean;
  initialThemeKey?: HomeThemeKey;
}) {
  const pathname = usePathname();
  const { t } = useHomeTheme(initialThemeKey);
  // 좁은 화면(md 미만)에서는 사이드바가 본문과 나란히 눌려서 둘 다 못 쓸 만큼
  // 좁아지던 문제가 있었다 — md 미만에서는 기본적으로 숨겨두고, 햄버거 버튼을 눌렀을
  // 때만 화면 왼쪽에서 전체 높이 드로어로 띄운다(학생 화면 헤더의 모바일 메뉴와
  // 같은 발상). 링크를 누르거나 배경을 누르면 자동으로 닫히고, md 이상에서는 원래처럼
  // 항상 보이는 고정 사이드바로 렌더링된다(아래 클래스의 md: 접두사들 참고).
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  // 신고/게시판/Q&A 안 읽음 개수 — 실시간 구독이라 새 항목이 들어오거나 확인 처리되면
  // 즉시 갱신된다. 권한이 없는 역할이 /admin에 들어와도 RLS가 빈 배열을 돌려줄
  // 뿐이라(에러 아님) 훅 자체는 항상 호출하고, 뱃지 노출만 아래에서 역할로 가른다.
  const { rows: unreadReports } = useRealtimeList<{ id: string }>("reports", {
    select: "id",
    filter: (q) => q.eq("status", "pending"),
  });
  const { rows: unreadPosts } = useRealtimeList<{ id: string }>("board_posts", {
    select: "id",
    filter: (q) => q.is("reviewed_at", null).eq("is_hidden", false),
  });
  const { rows: unreadQuestions } = useRealtimeList<{ id: string }>("questions", {
    select: "id",
    filter: (q) => q.is("reviewed_at", null).eq("status", "pending").eq("is_hidden", false),
  });
  const BADGE_COUNTS: Record<string, number> = {
    "/admin/reports": unreadReports.length,
    "/admin/board": unreadPosts.length,
    "/admin/qna": unreadQuestions.length,
  };
  // sub_editor나 is_council만으로 /admin에 들어온 student/teacher는 /admin/org-activities/*
  // 외에는 middleware가 접근 자체를 막으므로, 눌러도 튕겨나가기만 하는 다른 메뉴들은 아예
  // 보여주지 않는다 — "임원회 전용" 그룹만 보인다. designer(조회 전용)는 "탭 자체는 숨기지
  // 않는다"는 요건이라, 아래 모든 그룹 표시 조건에서 superadmin과 동일하게 취급해 전부
  // 보여준다(실제 조작은 다른 곳에서 DesignerModeGate가 막는다).
  const isDesigner = role === "designer";
  const hasAdminRole = !!role && ["editor", "admin", "superadmin", "designer"].includes(role);
  const close = () => setMobileOpen(false);

  return (
    <>
      {/* md 이상에서는 사이드바가 항상 보이므로 이 토글 바 자체가 필요 없다. */}
      <div className={`md:hidden flex items-center gap-2 bg-surface border-b ${t.adminAsideBorder} px-3 py-2`}>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className={`w-11 h-11 flex items-center justify-center rounded-md text-xl leading-none ${t.iconBtnHover}`}
          aria-label={mobileOpen ? "관리자 메뉴 닫기" : "관리자 메뉴 열기"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
        <span className="text-sm font-bold text-muted">관리자 메뉴</span>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={close} aria-hidden />
      )}
      <aside
        className={`${mobileOpen ? "flex" : "hidden"} md:flex flex-col gap-0.5 fixed md:static top-0 left-0 z-40 md:z-auto
        w-[240px] md:w-[190px] h-screen md:h-auto overflow-y-auto
        bg-surface border-r ${t.adminAsideBorder} p-2.5 shrink-0`}
      >
      {hasAdminRole && (
        <>
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} badgeCount={BADGE_COUNTS[n.href]} onNavigate={close} />
          ))}
        </>
      )}
      {(role === "admin" || role === "superadmin" || isDesigner) && (
        <>
          {ADMIN_ONLY_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} badgeCount={BADGE_COUNTS[n.href]} onNavigate={close} />
          ))}
        </>
      )}
      {hasAdminRole && <div className={`border-t ${t.adminAsideBorder} my-2`} />}
      {(isCouncil || role === "superadmin" || isDesigner) && (
        <>
          <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">임원회 전용</div>
          {ORG_ACTIVITIES_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} onNavigate={close} />
          ))}
        </>
      )}
      {(isJudiciary || role === "superadmin" || isDesigner) && (
        <>
          <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">사법위원회 전용</div>
          {JUDICIARY_ACTIVITIES_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} onNavigate={close} />
          ))}
        </>
      )}
      {(role === "superadmin" || isDesigner) && (
        <>
          <div className={`border-t ${t.adminAsideBorder} my-2`} />
          <div className="px-3 py-1 text-[11px] font-bold text-muted uppercase tracking-wider">관리자 전용</div>
          {SUPERADMIN_NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} active={pathname === n.href} t={t} onNavigate={close} />
          ))}
          <NavLink href="/admin/theme" label="테마" active={pathname === "/admin/theme"} t={t} onNavigate={close} />
        </>
      )}
      </aside>
    </>
  );
}
