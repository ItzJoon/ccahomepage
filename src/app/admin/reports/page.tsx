"use client";

import AdminTable, { truncateCellProps } from "@/components/admin/AdminTable";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { Report, ReportStatus } from "@/lib/types";

const STATUS_LABEL: Record<ReportStatus, string> = { pending: "대기 중", reviewed: "확인함", dismissed: "기각" };
const TARGET_TYPE_LABEL: Record<string, string> = { profile: "사용자", board_post: "게시글", board_comment: "댓글" };

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

export default function AdminReportsPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Report>("reports", { orderBy: { column: "created_at", ascending: false } });
  const [profilesById, setProfilesById] = useState<Record<string, { name: string | null; nickname: string | null; email: string }>>({});
  const { isAdmin, role, loading: roleLoading } = useMyRole();
  // designer(조회 전용)는 admin 전용 화면도 볼 수 있어야 하므로 이 경고 배너에서는 제외한다
  // (실제 조작 차단은 DesignerModeGate가 담당).
  const canView = isAdmin || role === "designer";
  const { t } = useHomeTheme();

  // reports.target_id는 target_type에 따라 다른 대상을 가리키는 범용 컬럼이라 profiles와
  // FK로 묶여있지 않다(외래키 임베딩 불가) — 신고자/신고 대상(사용자인 경우) id를 모아
  // 한 번에 조회해서 화면에서 이름으로 바꿔 보여준다.
  useEffect(() => {
    const ids = Array.from(
      new Set(
        rows.flatMap((r) => [r.reporter_id, r.target_type === "profile" ? r.target_id : null]).filter((x): x is string => !!x)
      )
    );
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("id, name, nickname, email")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, { name: string | null; nickname: string | null; email: string }> = {};
        (data ?? []).forEach((p: any) => { map[p.id] = p; });
        setProfilesById(map);
      });
  }, [rows, supabase]);

  const displayUser = (id: string | null) => {
    if (!id) return "-";
    const p = profilesById[id];
    return p ? p.nickname || p.name || p.email : "(알 수 없음)";
  };

  const setStatus = async (id: string, status: ReportStatus) => {
    await supabase.from("reports").update({ status }).eq("id", id);
    reload();
  };

  return (
    <div>
      <h2 className="text-[22px] mb-2">신고 내역</h2>
      <p className="text-muted mb-4">
        학생들이 닉네임 메뉴에서 접수한 신고 내역입니다. 처리 상태만 표시로 남기며,
        실제 제재(닉네임 변경, 이용 제한 등)는 별도로 처리해 주세요.
      </p>

      {!roleLoading && !canView && (
        <div className="bg-[#FFF3DC] text-gold text-sm rounded-lg p-3 mb-4">
          이 화면은 admin 이상만 열람할 수 있습니다.
        </div>
      )}

      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>신고자</th>
            <th className={`${t.adminTableHeaderCell} w-20`}>대상 종류</th>
            <th className={t.adminTableHeaderCell}>신고 대상</th>
            <th className={t.adminTableHeaderCell}>사유</th>
            <th className={`${t.adminTableHeaderCell} w-36`}>시각</th>
            <th className={`${t.adminTableHeaderCell} w-28`}>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={t.adminTableCell}>{displayUser(r.reporter_id)}</td>
              <td className={`${t.adminTableCell} text-muted`}>{TARGET_TYPE_LABEL[r.target_type] ?? r.target_type}</td>
              <td className={t.adminTableCell}>
                {r.target_type === "profile" ? displayUser(r.target_id) : r.target_id}
                {r.context && <div className="text-muted text-xs mt-0.5">{r.context}</div>}
              </td>
              <td className={t.adminTableCell}>
                <span {...truncateCellProps(r.reason || "-")}>{r.reason || "-"}</span>
              </td>
              <td className={`${t.adminTableCell} text-muted`}>{fmtDateTime(r.created_at)}</td>
              <td className={t.adminTableCell}>
                <select
                  className={t.adminInput}
                  value={r.status}
                  onChange={(e) => setStatus(r.id, e.target.value as ReportStatus)}
                >
                  {Object.entries(STATUS_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="text-muted text-center py-8 text-sm">접수된 신고가 없습니다.</td></tr>
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
