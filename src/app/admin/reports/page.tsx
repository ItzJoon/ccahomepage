"use client";

import AdminTable, { truncateCellProps } from "@/components/admin/AdminTable";
import ModerationPanel from "@/components/admin/ModerationPanel";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { Report, ReportStatus, SiteSettings } from "@/lib/types";

const STATUS_LABEL: Record<ReportStatus, string> = { pending: "대기 중", reviewed: "확인함", dismissed: "기각" };
const TARGET_TYPE_LABEL: Record<string, string> = { profile: "사용자", board_post: "게시글", board_comment: "댓글" };

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

interface TargetProfile {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
}

interface TargetContent {
  title?: string;
  content: string;
  is_hidden: boolean;
}

export default function AdminReportsPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Report>("reports", { orderBy: { column: "created_at", ascending: false } });
  const { rows: settingsRows } = useRealtimeList<SiteSettings>("site_settings");
  const settings = settingsRows.find((r) => r.id === "default");
  const [profilesById, setProfilesById] = useState<Record<string, TargetProfile>>({});
  const [contentByKey, setContentByKey] = useState<Record<string, TargetContent>>({});
  const { isAdmin, role, loading: roleLoading } = useMyRole();
  // designer(조회 전용)는 admin 전용 화면도 볼 수 있어야 하므로 이 경고 배너에서는 제외한다
  // (실제 조작 차단은 DesignerModeGate가 담당).
  const canView = isAdmin || role === "designer";
  // 신고 처리(콘텐츠 숨김·삭제, 경고/정지/영구차단)는 이제 designer도 admin과 동일하게 쓸 수
  // 있다(RLS의 board_posts_delete_own_or_admin/board_comments_delete_own_or_admin,
  // user_warnings_insert_admin 등이 is_designer()를 허용). 반면 아래 "제재 기준 설정"
  // 패널은 site_settings_update_admin이 designer로 확장되지 않았으므로, 그 패널은 계속
  // 순수 isAdmin(=admin/superadmin)만으로 gate해야 한다 — 이 둘을 섞어 쓰지 않도록 별도
  // 플래그로 분리한다.
  const canModerateReport = isAdmin || role === "designer";
  const { t } = useHomeTheme();

  const [openId, setOpenId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // reports.target_id는 target_type에 따라 다른 대상을 가리키는 범용 컬럼이라 profiles와
  // FK로 묶여있지 않다(외래키 임베딩 불가) — 신고자/신고 대상(사용자인 경우)/게시글·댓글
  // 작성자(target_author_id) id를 모아 한 번에 조회해서 화면에서 이름으로 바꿔 보여준다.
  // 경고/정지/차단 같은 실시간 상태는 이제 ModerationPanel이 스스로 다시 조회하므로 여기서는
  // 이름 표시에만 필요한 최소 필드만 들고 있는다.
  useEffect(() => {
    const ids = Array.from(
      new Set(
        rows.flatMap((r) => [r.reporter_id, r.target_type === "profile" ? r.target_id : null, r.target_author_id]).filter((x): x is string => !!x)
      )
    );
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("id, name, nickname, email")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, TargetProfile> = {};
        (data ?? []).forEach((p: any) => { map[p.id] = p; });
        setProfilesById(map);
      });
  }, [rows, supabase]);

  // 게시글/댓글 신고는 실제 본문·숨김 상태를 알아야 "숨김 처리/삭제" 버튼을 그 자리에서
  // 바로 쓸 수 있다. target_type별로 모아서 한 번씩만 조회한다.
  useEffect(() => {
    const postIds = rows.filter((r) => r.target_type === "board_post").map((r) => r.target_id);
    const commentIds = rows.filter((r) => r.target_type === "board_comment").map((r) => r.target_id);
    (async () => {
      const next: Record<string, TargetContent> = {};
      if (postIds.length > 0) {
        const { data } = await supabase.from("board_posts").select("id, title, content, is_hidden").in("id", postIds);
        (data ?? []).forEach((p: any) => { next[`board_post:${p.id}`] = { title: p.title, content: p.content, is_hidden: p.is_hidden }; });
      }
      if (commentIds.length > 0) {
        const { data } = await supabase.from("board_comments").select("id, content, is_hidden").in("id", commentIds);
        (data ?? []).forEach((c: any) => { next[`board_comment:${c.id}`] = { content: c.content, is_hidden: c.is_hidden }; });
      }
      setContentByKey(next);
    })();
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

  const markReviewed = async (id: string) => {
    await supabase.from("reports").update({ status: "reviewed" }).eq("id", id);
    reload();
  };

  const current = rows.find((r) => r.id === openId);
  const currentContentKey = current ? `${current.target_type}:${current.target_id}` : null;
  const currentContent = currentContentKey ? contentByKey[currentContentKey] : null;

  const toggleHiddenContent = async () => {
    if (!current || !currentContent) return;
    const table = current.target_type === "board_post" ? "board_posts" : "board_comments";
    await supabase.from(table).update({ is_hidden: !currentContent.is_hidden }).eq("id", current.target_id);
    await markReviewed(current.id);
    setActionMsg(currentContent.is_hidden ? "숨김을 해제했습니다." : "숨김 처리했습니다.");
    setTimeout(() => setActionMsg(null), 3000);
  };

  const removeContent = async () => {
    if (!current) return;
    if (!confirm("이 게시물을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const table = current.target_type === "board_post" ? "board_posts" : "board_comments";
    await supabase.from(table).delete().eq("id", current.target_id);
    await markReviewed(current.id);
    setActionMsg("삭제했습니다.");
    setTimeout(() => setActionMsg(null), 3000);
  };

  const updateThreshold = async (field: keyof SiteSettings, value: number) => {
    await supabase.from("site_settings").update({ [field]: value }).eq("id", "default");
  };

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${current ? "lg:grid-cols-[1fr_380px]" : ""}`}>
      <div className="min-w-0">
        <h2 className="text-[22px] mb-2">신고 내역</h2>
        <p className="text-muted mb-2">
          학생들이 닉네임 메뉴에서 접수한 신고 내역입니다. 목록에서 항목을 눌러 상세 화면에서
          숨김·삭제·경고·정지·영구차단을 바로 처리할 수 있습니다.
        </p>
        <button type="button" onClick={() => setShowSettings((v) => !v)} className="text-blue text-xs font-bold mb-3">
          {showSettings ? "제재 기준 설정 닫기" : "제재 기준 설정"}
        </button>
        {showSettings && settings && (
          <div className={`${t.dashStatCard} mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl`}>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">자동 정지 기준 (경고 N회)</label>
              <input
                type="number"
                min={1}
                disabled={!isAdmin}
                className={t.adminInput}
                defaultValue={settings.warning_suspend_threshold}
                onBlur={(e) => updateThreshold("warning_suspend_threshold", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">자동 정지 기간 (일)</label>
              <input
                type="number"
                min={1}
                disabled={!isAdmin}
                className={t.adminInput}
                defaultValue={settings.warning_suspend_days}
                onBlur={(e) => updateThreshold("warning_suspend_days", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">자동 영구차단 기준 (경고 N회)</label>
              <input
                type="number"
                min={1}
                disabled={!isAdmin}
                className={t.adminInput}
                defaultValue={settings.warning_ban_threshold}
                onBlur={(e) => updateThreshold("warning_ban_threshold", Number(e.target.value))}
              />
            </div>
          </div>
        )}

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
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className={`cursor-pointer ${t.adminTableRowHover} ${openId === r.id ? t.adminTableRowActive : ""}`}
              >
                <td className={t.adminTableCell}>{displayUser(r.reporter_id)}</td>
                <td className={`${t.adminTableCell} text-muted`}>{TARGET_TYPE_LABEL[r.target_type] ?? r.target_type}</td>
                <td className={t.adminTableCell}>
                  {r.target_type === "profile" ? displayUser(r.target_id) : displayUser(r.target_author_id)}
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
                    onClick={(e) => e.stopPropagation()}
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

      {current && (
        <div className={`${t.adminEditPanel} flex flex-col gap-2 sticky top-20`}>
          <div className="flex items-center justify-between">
            <h3 className="m-0">신고 상세</h3>
            <button type="button" onClick={() => setOpenId(null)} className="text-muted text-xl leading-none">✕</button>
          </div>
          <p className="text-xs text-muted m-0">
            {TARGET_TYPE_LABEL[current.target_type]} · {fmtDateTime(current.created_at)}
          </p>
          <p className="text-sm m-0"><span className="font-bold">신고자:</span> {displayUser(current.reporter_id)}</p>
          <p className="text-sm m-0"><span className="font-bold">사유:</span> {current.reason || "-"}</p>
          {current.context && <p className="text-sm m-0"><span className="font-bold">비고:</span> {current.context}</p>}

          {currentContent && (
            <div className="bg-bg rounded-lg p-3 mt-1">
              {currentContent.title && <div className="font-bold text-sm mb-1">{currentContent.title}</div>}
              <div className="text-sm whitespace-pre-wrap">{currentContent.content}</div>
              {currentContent.is_hidden && <div className="text-muted text-xs mt-1">(현재 숨김 상태)</div>}
            </div>
          )}

          {canModerateReport && currentContent && (
            <div className="flex gap-2 mt-1">
              <button onClick={toggleHiddenContent} className={t.adminBtnSecondary}>
                {currentContent.is_hidden ? "숨김 해제" : "숨김 처리"}
              </button>
              <button onClick={removeContent} className={t.adminBtnDanger}>삭제</button>
            </div>
          )}

          {current.target_author_id && (
            <div className="border-t border-border mt-2 pt-3 flex flex-col gap-2">
              <div className="text-sm font-bold">작성자: {displayUser(current.target_author_id)}</div>
              {canModerateReport ? (
                <ModerationPanel
                  targetUserId={current.target_author_id}
                  reportId={current.id}
                  onAfterAction={() => markReviewed(current.id)}
                />
              ) : (
                <p className="text-muted text-xs">제재 조치는 admin 이상만 가능합니다.</p>
              )}
            </div>
          )}

          {actionMsg && (
            <div className="text-sm font-bold bg-[#E4F5EE] text-teal rounded-lg px-3 py-2 mt-1">{actionMsg}</div>
          )}
        </div>
      )}
    </div>
  );
}
