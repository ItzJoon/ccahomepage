"use client";

import AdminTable, { truncateCellProps } from "@/components/admin/AdminTable";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { Report, ReportStatus, SiteSettings, UserWarning } from "@/lib/types";

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
  warning_count: number;
  suspended_until: string | null;
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
  const { t } = useHomeTheme();

  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [suspendDays, setSuspendDays] = useState(3);
  const [showSettings, setShowSettings] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [targetWarnings, setTargetWarnings] = useState<UserWarning[]>([]);

  // 특정 계정 하나(target_author_id)의 최신 상태(경고 누적/정지 여부)를 다시 받아온다.
  // profilesById는 reports 목록이 바뀔 때만 통째로 다시 채워지는데, 경고 부여/정지/차단은
  // reports 목록 자체를 바꾸지 않으므로(상태만 "확인함"으로 바뀔 뿐) 그 갱신을 기다리지
  // 않는다 — 조치 직후 이 함수를 직접 호출해서 방금 바뀐 값을 즉시 반영한다. 이게 없으면
  // 실제로는 정상 처리됐는데도 화면에는 예전 값(경고 0회, 정지 없음)이 계속 보여서
  // "눌러도 아무 일도 안 일어나는 것처럼" 보였다.
  const refreshTargetProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, nickname, email, warning_count, suspended_until")
      .eq("id", userId)
      .maybeSingle();
    if (data) setProfilesById((prev) => ({ ...prev, [userId]: data as TargetProfile }));
  };

  // reports.target_id는 target_type에 따라 다른 대상을 가리키는 범용 컬럼이라 profiles와
  // FK로 묶여있지 않다(외래키 임베딩 불가) — 신고자/신고 대상(사용자인 경우)/게시글·댓글
  // 작성자(target_author_id) id를 모아 한 번에 조회해서 화면에서 이름으로 바꿔 보여준다.
  useEffect(() => {
    const ids = Array.from(
      new Set(
        rows.flatMap((r) => [r.reporter_id, r.target_type === "profile" ? r.target_id : null, r.target_author_id]).filter((x): x is string => !!x)
      )
    );
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("id, name, nickname, email, warning_count, suspended_until")
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
  const currentAuthor = current?.target_author_id ? profilesById[current.target_author_id] : null;

  // 상세 패널을 열 때마다 그 작성자가 지금까지 받은 경고 이력을 불러온다(철회 여부와
  // 무관하게 전부 가져오고, 화면에서 철회된 것은 흐리게 구분해서 보여준다).
  useEffect(() => {
    const targetId = current?.target_author_id;
    if (!targetId) { setTargetWarnings([]); return; }
    setWarningReason("");
    supabase
      .from("user_warnings")
      .select("*")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTargetWarnings((data as UserWarning[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.target_author_id]);

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

  const refreshTargetWarnings = async (userId: string) => {
    const { data } = await supabase
      .from("user_warnings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setTargetWarnings((data as UserWarning[]) ?? []);
  };

  const issueWarning = async () => {
    if (!current || !current.target_author_id) return;
    const reason = warningReason.trim();
    if (!reason) {
      setActionMsg("경고 사유를 입력해 주세요.");
      return;
    }
    if (!confirm(`${displayUser(current.target_author_id)}님에게 경고를 부여합니다. 계속하시겠습니까?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("issue_user_warning", {
      target_user_id: current.target_author_id,
      p_report_id: current.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) {
      setActionMsg(`경고 부여에 실패했습니다: ${error.message}`);
    } else {
      const result = data as { warning_count: number; auto_action: string | null };
      const autoMsg =
        result.auto_action === "banned"
          ? " (누적 기준 초과로 영구 차단되었습니다)"
          : result.auto_action === "suspended"
          ? " (누적 기준 초과로 자동 정지되었습니다)"
          : "";
      setActionMsg(`✅ 경고를 부여했습니다 (누적 ${result.warning_count}회)${autoMsg}`);
      setWarningReason("");
      await refreshTargetProfile(current.target_author_id);
      await refreshTargetWarnings(current.target_author_id);
    }
    await markReviewed(current.id);
    setTimeout(() => setActionMsg(null), 6000);
  };

  const revokeWarning = async (warningId: string) => {
    if (!current?.target_author_id) return;
    if (!confirm("이 경고를 철회하시겠습니까? 누적 횟수가 1 줄어듭니다.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("revoke_user_warning", { warning_id: warningId });
    setBusy(false);
    setActionMsg(error ? `철회에 실패했습니다: ${error.message}` : "✅ 경고를 철회했습니다.");
    if (!error) {
      await refreshTargetProfile(current.target_author_id);
      await refreshTargetWarnings(current.target_author_id);
    }
    setTimeout(() => setActionMsg(null), 6000);
  };

  const suspendAccount = async () => {
    if (!current || !current.target_author_id) return;
    if (!confirm(`${displayUser(current.target_author_id)}님을 ${suspendDays}일간 정지시킵니다. 계속하시겠습니까?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("suspend_user", {
      target_user_id: current.target_author_id,
      days: suspendDays,
      p_reason: current.reason || "신고 접수에 따른 계정 정지",
    });
    setBusy(false);
    setActionMsg(error ? `정지 처리에 실패했습니다: ${error.message}` : `✅ ${suspendDays}일간 정지시켰습니다.`);
    if (!error) await refreshTargetProfile(current.target_author_id);
    await markReviewed(current.id);
    setTimeout(() => setActionMsg(null), 6000);
  };

  const banAccount = async () => {
    if (!current || !current.target_author_id) return;
    if (!confirm(`${displayUser(current.target_author_id)}님을 영구 차단합니다. 계속하시겠습니까?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("ban_user_permanently", {
      target_user_id: current.target_author_id,
      p_reason: current.reason || "신고 접수에 따른 영구 차단",
    });
    setBusy(false);
    setActionMsg(error ? `차단에 실패했습니다: ${error.message}` : "✅ 영구 차단했습니다.");
    if (!error) await refreshTargetProfile(current.target_author_id);
    await markReviewed(current.id);
    setTimeout(() => setActionMsg(null), 6000);
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

          {isAdmin && currentContent && (
            <div className="flex gap-2 mt-1">
              <button onClick={toggleHiddenContent} className={t.adminBtnSecondary}>
                {currentContent.is_hidden ? "숨김 해제" : "숨김 처리"}
              </button>
              <button onClick={removeContent} className={t.adminBtnDanger}>삭제</button>
            </div>
          )}

          {current.target_author_id && (
            <div className="border-t border-border mt-2 pt-3 flex flex-col gap-2">
              <div className="text-sm font-bold">
                작성자: {displayUser(current.target_author_id)}
                {currentAuthor && (
                  <span className="text-muted font-normal text-xs ml-1">
                    (경고 {currentAuthor.warning_count}회
                    {currentAuthor.suspended_until && new Date(currentAuthor.suspended_until).getTime() > Date.now()
                      ? ` · ${fmtDateTime(currentAuthor.suspended_until)}까지 정지 중`
                      : ""}
                    )
                  </span>
                )}
              </div>

              {isAdmin ? (
                <>
                  <label className="text-xs font-bold text-muted">경고 사유 (학생에게 그대로 보입니다)</label>
                  <textarea
                    rows={2}
                    value={warningReason}
                    onChange={(e) => setWarningReason(e.target.value)}
                    placeholder="예: 게시판 비방 댓글 작성"
                    className={t.adminInput}
                  />
                  <button onClick={issueWarning} disabled={busy} className={`${t.adminBtnSecondary} disabled:opacity-50`}>
                    ⚠️ 경고 부여
                  </button>

                  {targetWarnings.length > 0 && (
                    <div className="flex flex-col gap-1 bg-bg rounded-lg p-2.5">
                      <div className="text-xs font-bold text-muted">경고 이력</div>
                      {targetWarnings.map((w) => (
                        <div key={w.id} className={`text-xs flex items-start justify-between gap-2 ${w.revoked_at ? "opacity-40" : ""}`}>
                          <div>
                            <div>{w.reason || "(사유 없음)"}</div>
                            <div className="text-muted">
                              {fmtDateTime(w.created_at)}{w.revoked_at ? " · 철회됨" : ""}
                            </div>
                          </div>
                          {!w.revoked_at && (
                            <button onClick={() => revokeWarning(w.id)} disabled={busy} className="text-red font-bold shrink-0">
                              철회
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min={1}
                      value={suspendDays}
                      onChange={(e) => setSuspendDays(Number(e.target.value))}
                      className={`${t.adminInput} w-20`}
                    />
                    <span className="text-xs text-muted">일간</span>
                    <button onClick={suspendAccount} disabled={busy} className={`${t.adminBtnSecondary} disabled:opacity-50`}>
                      일시 정지
                    </button>
                  </div>
                  <button onClick={banAccount} disabled={busy} className={`${t.adminBtnDanger} disabled:opacity-50 text-left`}>
                    🚫 영구 차단
                  </button>
                </>
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
