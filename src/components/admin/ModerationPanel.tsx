"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { UserWarning } from "@/lib/types";

interface TargetInfo {
  id: string;
  email: string;
  name: string | null;
  nickname: string | null;
  warning_count: number;
  suspended_until: string | null;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

/**
 * 경고 부여/철회, 일시정지/해제, 영구차단/해제를 한 곳에 모은 공용 패널.
 * 신고 상세 화면(admin/reports)과 구성원 프로필 화면(members/[id])에서 함께 쓴다 —
 * 두 곳 모두 "이 계정에게 조치를 취한다"는 점은 같고 신고 문맥(report_id)만 있고 없고의
 * 차이라, targetUserId 하나만 받으면 나머지(현재 경고/정지/차단 상태, 이력 조회, RPC 호출)는
 * 이 컴포넌트가 전부 스스로 처리한다 — 호출하는 화면이 이미 갖고 있는 데이터에 기대지 않고
 * 항상 최신 상태를 직접 다시 불러오므로, 조치 직후에도 화면이 예전 값을 보여주는 일이 없다.
 */
export default function ModerationPanel({
  targetUserId,
  reportId,
  onAfterAction,
}: {
  targetUserId: string;
  reportId?: string;
  onAfterAction?: () => void;
}) {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const [target, setTarget] = useState<TargetInfo | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [warningReason, setWarningReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const displayName = target ? target.nickname || target.name || target.email : "";

  const refresh = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, name, nickname, warning_count, suspended_until")
      .eq("id", targetUserId)
      .maybeSingle();
    if (data) {
      setTarget(data as TargetInfo);
      const { data: dm } = await supabase
        .from("directory_members")
        .select("is_allowed")
        .eq("email", data.email)
        .maybeSingle();
      setIsBanned(dm ? !dm.is_allowed : false);
    }
    const { data: w } = await supabase
      .from("user_warnings")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });
    setWarnings((w as UserWarning[]) ?? []);
  };

  useEffect(() => {
    setWarningReason("");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 6000);
  };

  const runRpc = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    return { data, error };
  };

  const issueWarning = async () => {
    const reason = warningReason.trim();
    if (!reason) {
      flash("경고 사유를 입력해 주세요.");
      return;
    }
    if (!confirm(`${displayName}님에게 경고를 부여합니다. 계속하시겠습니까?`)) return;
    const { data, error } = await runRpc("issue_user_warning", {
      target_user_id: targetUserId,
      p_report_id: reportId ?? null,
      p_reason: reason,
    });
    if (error) {
      flash(`경고 부여에 실패했습니다: ${error.message}`);
      return;
    }
    const result = data as { warning_count: number; auto_action: string | null };
    const autoMsg =
      result.auto_action === "banned"
        ? " (누적 기준 초과로 영구 차단되었습니다)"
        : result.auto_action === "suspended"
        ? " (누적 기준 초과로 자동 정지되었습니다)"
        : "";
    flash(`✅ 경고를 부여했습니다 (누적 ${result.warning_count}회)${autoMsg}`);
    setWarningReason("");
    await refresh();
    onAfterAction?.();
  };

  const revokeWarning = async (warningId: string) => {
    if (!confirm("이 경고를 철회하시겠습니까? 누적 횟수가 1 줄어듭니다.")) return;
    const { error } = await runRpc("revoke_user_warning", { warning_id: warningId });
    flash(error ? `철회에 실패했습니다: ${error.message}` : "✅ 경고를 철회했습니다.");
    if (!error) {
      await refresh();
      onAfterAction?.();
    }
  };

  const suspend = async () => {
    if (!confirm(`${displayName}님을 ${suspendDays}일간 정지시킵니다. 계속하시겠습니까?`)) return;
    const { error } = await runRpc("suspend_user", {
      target_user_id: targetUserId,
      days: suspendDays,
      p_reason: "관리자 직접 정지",
    });
    flash(error ? `정지 처리에 실패했습니다: ${error.message}` : `✅ ${suspendDays}일간 정지시켰습니다.`);
    if (!error) {
      await refresh();
      onAfterAction?.();
    }
  };

  const unsuspend = async () => {
    if (!confirm(`${displayName}님의 정지를 해제하시겠습니까?`)) return;
    const { error } = await runRpc("unsuspend_user", { target_user_id: targetUserId });
    flash(error ? `정지 해제에 실패했습니다: ${error.message}` : "✅ 정지를 해제했습니다.");
    if (!error) {
      await refresh();
      onAfterAction?.();
    }
  };

  const ban = async () => {
    if (!confirm(`${displayName}님을 영구 차단합니다. 계속하시겠습니까?`)) return;
    const { error } = await runRpc("ban_user_permanently", {
      target_user_id: targetUserId,
      p_reason: "관리자 직접 영구 차단",
    });
    flash(error ? `차단에 실패했습니다: ${error.message}` : "✅ 영구 차단했습니다.");
    if (!error) {
      await refresh();
      onAfterAction?.();
    }
  };

  const unban = async () => {
    if (!confirm(`${displayName}님의 영구 차단을 해제하시겠습니까?`)) return;
    const { error } = await runRpc("unban_user_permanently", { target_user_id: targetUserId });
    flash(error ? `차단 해제에 실패했습니다: ${error.message}` : "✅ 차단을 해제했습니다.");
    if (!error) {
      await refresh();
      onAfterAction?.();
    }
  };

  if (!target) return null;
  const isSuspended = !!target.suspended_until && new Date(target.suspended_until).getTime() > Date.now();

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-bold">
        경고 {target.warning_count}회
        {isSuspended && <span className="text-red ml-1">· {fmtDateTime(target.suspended_until!)}까지 정지 중</span>}
        {isBanned && <span className="text-red ml-1">· 영구 차단됨</span>}
      </div>

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

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1 bg-bg rounded-lg p-2.5">
          <div className="text-xs font-bold text-muted">경고 이력</div>
          {warnings.map((w) => (
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

      {isSuspended ? (
        <button onClick={unsuspend} disabled={busy} className={`${t.adminBtnSecondary} disabled:opacity-50`}>
          정지 해제
        </button>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="number"
            min={1}
            value={suspendDays}
            onChange={(e) => setSuspendDays(Number(e.target.value))}
            className={`${t.adminInput} w-20`}
          />
          <span className="text-xs text-muted">일간</span>
          <button onClick={suspend} disabled={busy} className={`${t.adminBtnSecondary} disabled:opacity-50`}>
            일시 정지
          </button>
        </div>
      )}

      {isBanned ? (
        <button onClick={unban} disabled={busy} className={`${t.adminBtnSecondary} disabled:opacity-50 text-left`}>
          🔓 영구 차단 해제
        </button>
      ) : (
        <button onClick={ban} disabled={busy} className={`${t.adminBtnDanger} disabled:opacity-50 text-left`}>
          🚫 영구 차단
        </button>
      )}

      {actionMsg && (
        <div className="text-sm font-bold bg-[#E4F5EE] text-teal rounded-lg px-3 py-2 mt-1">{actionMsg}</div>
      )}
    </div>
  );
}
