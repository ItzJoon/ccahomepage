"use client";

import AdminTable from "@/components/admin/AdminTable";
import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { fakeName, fakeText } from "@/lib/fakeData";
import { roleLabel } from "@/lib/roleLabel";
import { adminDisplayName } from "@/lib/displayName";
import type { AuditAction, AuditLog } from "@/lib/types";

const PAGE_SIZE = 50;

const TABLE_LABELS: Record<string, string> = {
  posts: "게시글(공지/뉴스)",
  events: "일정",
  organizations: "부서",
  members: "구성원",
  rules: "규정",
  answers: "Q&A 답변",
  profiles: "회원 권한",
  directory_members: "외부 계정 명단",
  login_access_requests: "외부 계정 요청",
  user_badges: "뱃지 지급",
  proposals: "안건함",
  org_events: "부서 일정",
  org_records: "부서 활동기록",
  site_settings: "사이트 설정",
  board_posts: "게시판",
  board_comments: "게시판 댓글",
  questions: "Q&A 질문",
};

// 테이블마다 insert/update/delete가 실제로 뜻하는 행위가 달라서(예: user_badges의
// insert는 "지급", delete는 "회수") 테이블별로 자연스러운 한국어 라벨을 따로 정의한다.
// is_hidden 토글은 여러 테이블(posts/events/board_posts/questions/proposals/org_records/
// board_comments)에 공통으로 있으므로, before/after를 비교해서 테이블과 무관하게 한 번에 처리한다.
function actionLabel(row: Pick<AuditLog, "target_table" | "action" | "before_data" | "after_data">) {
  const table = row.target_table;
  const action = row.action;
  if (table === "user_badges") return action === "insert" ? "지급" : action === "delete" ? "회수" : "수정";
  if (table === "login_access_requests") return "승인/차단 처리";
  if (table === "directory_members") return action === "insert" ? "명단 등록" : "허용 상태 변경";
  if (table === "profiles") return "권한 변경";
  if (table === "site_settings") return "점검모드 변경";
  if (action === "update") {
    const before = row.before_data as Record<string, unknown> | null;
    const after = row.after_data as Record<string, unknown> | null;
    if (before && after && "is_hidden" in after && before.is_hidden !== after.is_hidden) {
      return after.is_hidden ? "숨김 처리" : "숨김 해제";
    }
    if (table === "proposals") return "상태 변경";
  }
  return action === "insert" ? "작성" : action === "update" ? "수정" : "삭제";
}

// before/after 데이터 중 사람이 알아볼 수 있는 필드를 하나 골라 목록에 짧게 보여준다.
function summarize(row: AuditLog): string {
  const data = row.after_data ?? row.before_data;
  if (!data) return row.target_id ?? "-";
  switch (row.target_table) {
    case "profiles":
      return `${adminDisplayName(data as { nickname?: string | null; name?: string | null; email?: string | null })} → ${roleLabel(data.role as string)}`;
    case "login_access_requests":
      return `${data.email ?? "-"} (${data.status})`;
    case "directory_members":
      return `${data.email ?? "-"} (허용: ${data.is_allowed ? "예" : "아니오"})`;
    case "site_settings":
      return `점검모드: ${data.maintenance_mode ? "켜짐" : "꺼짐"}`;
    case "proposals":
      return `${data.title ?? "-"} → ${data.status}`;
    case "board_comments":
      return typeof data.content === "string" ? data.content.slice(0, 40) : row.target_id ?? "-";
    default:
      return data.title || data.name || data.email || row.target_id || "-";
  }
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

// 변경 전/후 원본 JSON을 펼쳐서 보여줄 때도 role 값은 화면 표시명(developer)으로 바꿔서
// 보여준다 — 실제 DB에 저장된 값(superadmin)이나 audit_logs 원본 자체를 건드리는 건
// 아니고, 이 화면에 그릴 때만 한 번 더 바꿔치기하는 표시용 복사본이다.
function relabelRolesForDisplay(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return data;
  const clone: Record<string, unknown> = { ...data };
  if (clone.role === "superadmin") clone.role = roleLabel("superadmin");
  return clone;
}

interface Row extends AuditLog {
  profiles: { name: string | null; nickname: string | null; email: string } | null;
}

export default function AdminActivityLogsPage() {
  const supabase = createClient();
  const { isSuperadmin, role, loading: roleLoading } = useMyRole();
  // designer(조회 전용)는 superadmin 전용 화면도 볼 수 있어야 한다 — 실제 조작 차단은
  // DesignerModeGate(inert)가 담당하므로 여기서는 열람 자격만 함께 인정한다.
  const canView = isSuperadmin || role === "designer";
  // 활동 로그는 "누가 누구에게 무엇을 했는지"가 그대로 담겨 있어(이름/이메일/경고 사유
  // 원문 등) 가장 민감하다 — designer에게는 언제/어떤 테이블/어떤 행위인지 구조만
  // 보여주고, 실제 사용자 식별 정보와 내용은 전부 가짜 값으로 바꾼다.
  const maskPII = role === "designer";
  const { t } = useHomeTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | AuditAction>("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    (async () => {
      // 이름/이메일 검색은 audit_logs가 아니라 profiles 쪽 조건이라, 먼저 일치하는
      // 사용자 id를 찾은 뒤 audit_logs.user_id로 필터링한다(임베드 조인 필터보다 단순하고 안전).
      let userIds: string[] | null = null;
      const q = search.trim();
      if (q) {
        const { data: matches } = await supabase
          .from("profiles")
          .select("id")
          .or(`name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`);
        userIds = (matches ?? []).map((m) => m.id);
        if (userIds.length === 0) {
          setRows([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from("audit_logs")
        .select("*, profiles(name, nickname, email)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (userIds) query = query.in("user_id", userIds);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      if (tableFilter !== "all") query = query.eq("target_table", tableFilter);
      if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const { data, count } = await query;
      setRows((data as any) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    })();
  }, [canView, search, actionFilter, tableFilter, dateFrom, dateTo, page, supabase]);

  // 필터/검색이 바뀌면 첫 페이지로 되돌린다.
  useEffect(() => {
    setPage(0);
  }, [search, actionFilter, tableFilter, dateFrom, dateTo]);

  if (!roleLoading && !canView) {
    return (
      <div className="bg-[#FFF3DC] text-gold text-sm rounded-lg p-4">
        이 화면은 developer만 열람할 수 있습니다.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h2 className="text-[22px] mb-2">활동 로그</h2>
      <p className="text-muted mb-4 text-sm">
        관리자·에디터가 사이트 데이터를 추가·수정·삭제·승인한 기록입니다. DB 트리거로
        자동 기록되며, 클라이언트에서 조작할 수 없습니다.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className={`${t.adminInput} w-full max-w-xs`}
          placeholder="사용자 이름 또는 이메일 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={t.adminInput}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as any)}
        >
          <option value="all">행위 전체</option>
          <option value="insert">작성/등록</option>
          <option value="update">수정</option>
          <option value="delete">삭제</option>
        </select>
        <select
          className={t.adminInput}
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
        >
          <option value="all">대상 전체</option>
          {Object.entries(TABLE_LABELS).map(([table, label]) => (
            <option key={table} value={table}>{label}</option>
          ))}
        </select>
        <input
          type="date"
          className={t.adminInput}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <span className="self-center text-muted text-sm">~</span>
        <input
          type="date"
          className={t.adminInput}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <AdminTable>
        <thead>
          <tr>
            <th className={`${t.adminTableHeaderCell} w-40`}>시각</th>
            <th className={`${t.adminTableHeaderCell} w-40`}>사용자</th>
            <th className={`${t.adminTableHeaderCell} w-28`}>대상</th>
            <th className={`${t.adminTableHeaderCell} w-20`}>행위</th>
            <th className={t.adminTableHeaderCell}>내용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                className={`cursor-pointer ${t.adminTableRowHover} ${expandedId === r.id ? t.adminTableRowActive : ""}`}
              >
                <td className={`${t.adminTableCell} text-muted`}>{fmtDateTime(r.created_at)}</td>
                <td className={t.adminTableCell}>
                  {maskPII
                    ? r.user_id
                      ? fakeName(r.user_id)
                      : "시스템"
                    : adminDisplayName(r.profiles, "시스템")}
                </td>
                <td className={t.adminTableCell}>{TABLE_LABELS[r.target_table ?? ""] ?? r.target_table}</td>
                <td className={t.adminTableCell}>{actionLabel(r)}</td>
                <td className={`${t.adminTableCell} truncate max-w-[320px]`}>{maskPII ? fakeText() : summarize(r)}</td>
              </tr>
              {expandedId === r.id && (
                <tr>
                  <td colSpan={5} className="p-3 border-b border-border bg-[#F7F8FB]">
                    {maskPII ? (
                      <div className="text-muted text-xs p-2">
                        🔒 designer 계정에는 변경 전/후 상세 내용이 표시되지 않습니다(개인정보 보호).
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="font-bold text-muted mb-1">변경 전</div>
                          <pre className="whitespace-pre-wrap break-all bg-white border border-border rounded-lg p-2.5 m-0">
                            {r.before_data ? JSON.stringify(relabelRolesForDisplay(r.before_data), null, 2) : "(없음)"}
                          </pre>
                        </div>
                        <div>
                          <div className="font-bold text-muted mb-1">변경 후</div>
                          <pre className="whitespace-pre-wrap break-all bg-white border border-border rounded-lg p-2.5 m-0">
                            {r.after_data ? JSON.stringify(relabelRolesForDisplay(r.after_data), null, 2) : "(없음)"}
                          </pre>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">기록이 없습니다.</td></tr>
          )}
          {loading && (
            <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">불러오는 중…</td></tr>
          )}
        </tbody>
      </AdminTable>

      <div className="flex items-center justify-between mt-3.5">
        <span className="text-muted text-xs">전체 {total}건</span>
        <div className="flex items-center gap-2">
          <button
            className={`${t.adminBtnSecondary} disabled:opacity-40`}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            이전
          </button>
          <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
          <button
            className={`${t.adminBtnSecondary} disabled:opacity-40`}
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
