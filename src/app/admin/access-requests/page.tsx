"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import AdminTable from "@/components/admin/AdminTable";
import { fakeEmail } from "@/lib/fakeData";
import { adminDisplayName } from "@/lib/displayName";
import { roleLabel } from "@/lib/roleLabel";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import type { DirectoryMember, LoginAccessRequest, Profile, SiteSettings } from "@/lib/types";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "대기 중", className: "text-gold" },
  approved: { text: "허용됨", className: "text-teal" },
  blocked: { text: "차단됨", className: "text-red" },
};

export default function AdminAccessRequestsPage() {
  const supabase = createClient();
  const { rows: allRows, reload } = useRealtimeList<LoginAccessRequest>("login_access_requests", {
    orderBy: { column: "attempted_at", ascending: false },
  });
  const { rows: directory } = useRealtimeList<DirectoryMember>("directory_members", {
    select: "email, member_type",
  });
  // 학교 명단(학생/교사)에 있는 이메일은 여기서 제외한다 — 명단에 등록되기 전에 시도했던
  // 기록이 login_access_requests에 그대로 남아있어서, 지금은 정상적인 학교 계정인데도 이
  // "외부 계정 관리" 화면에 계속 뜨는 문제가 있었다(정지·차단 계정 화면과 표시 범위가
  // 겹침). 이 화면은 명단에 아예 없거나 member_type='other'인 외부 계정만 다룬다.
  const schoolEmails = useMemo(
    () => new Set(directory.filter((d) => d.member_type !== "other").map((d) => d.email)),
    [directory]
  );
  const rows = useMemo(() => allRows.filter((r) => !schoolEmails.has(r.email)), [allRows, schoolEmails]);
  const { rows: settingsRows } = useRealtimeList<SiteSettings>("site_settings");
  const settings = settingsRows.find((r) => r.id === "default");
  const { rows: profiles } = useRealtimeList<Profile>("profiles", { select: "id, email, role" });
  const profileByEmail = useMemo(() => Object.fromEntries(profiles.map((p) => [p.email, p])), [profiles]);
  const { myId, isAdmin, isSuperadmin, role, loading: roleLoading } = useMyRole();
  const { t } = useHomeTheme();
  // designer(조회 전용)는 admin 전용 화면도 볼 수 있어야 하므로 경고 배너에서는 제외한다
  // (실제 조작 차단은 DesignerModeGate가 담당).
  const canView = isAdmin || role === "designer";
  // designer는 이 화면 구조는 볼 수 있어야 하지만, 실제 로그인 시도 이메일(개인정보)은
  // 볼 이유가 없다 — 항상 같은 가짜 이메일로 바꿔서 보여준다.
  const maskPII = role === "designer";
  const [busyId, setBusyId] = useState<string | null>(null);
  const [togglingRestriction, setTogglingRestriction] = useState(false);

  const approve = async (req: LoginAccessRequest) => {
    if (!myId) return;
    setBusyId(req.id);
    const { data: existing } = await supabase
      .from("directory_members")
      .select("id")
      .eq("email", req.email)
      .maybeSingle();
    if (existing) {
      await supabase.from("directory_members").update({ is_allowed: true }).eq("id", existing.id);
    } else {
      await supabase
        .from("directory_members")
        .insert({ email: req.email, member_type: "other", display_name: req.email, is_allowed: true });
    }
    await supabase
      .from("login_access_requests")
      .update({ status: "approved", decided_by: myId, decided_at: new Date().toISOString() })
      .eq("id", req.id);
    setBusyId(null);
    reload();
  };

  const block = async (req: LoginAccessRequest) => {
    if (!myId) return;
    setBusyId(req.id);
    await supabase
      .from("login_access_requests")
      .update({ status: "blocked", decided_by: myId, decided_at: new Date().toISOString() })
      .eq("id", req.id);
    setBusyId(null);
    reload();
  };

  // 차단된 계정을 다시 허용 상태로 되돌린다. directory_members.is_allowed를 true로 올리고
  // login_access_requests도 approved로 되돌린 뒤, 누가/언제 해제했는지 audit_logs에 남긴다.
  const unblock = async (req: LoginAccessRequest) => {
    if (!myId) return;
    setBusyId(req.id);
    const { data: existing } = await supabase
      .from("directory_members")
      .select("id")
      .eq("email", req.email)
      .maybeSingle();
    if (existing) {
      await supabase.from("directory_members").update({ is_allowed: true }).eq("id", existing.id);
    }
    await supabase
      .from("login_access_requests")
      .update({ status: "approved", decided_by: myId, decided_at: new Date().toISOString() })
      .eq("id", req.id);
    await supabase.from("audit_logs").insert({
      user_id: myId,
      action: "unban",
      target_table: "directory_members",
      target_id: req.email,
      after_data: { reason: "access-requests 화면에서 차단 해제" },
    });
    setBusyId(null);
    reload();
  };

  // 이미 허용한 계정을 다시 미승인 상태로 되돌린다. directory_members의 is_allowed를 false로
  // 내리고(영구 차단이 아니라 "다시 승인 대기" 상태), login_access_requests도 pending으로
  // 되돌려서 대기 목록에 다시 나타나게 한다.
  const revokeApproval = async (req: LoginAccessRequest) => {
    setBusyId(req.id);
    const { data: existing } = await supabase
      .from("directory_members")
      .select("id")
      .eq("email", req.email)
      .maybeSingle();
    if (existing) {
      await supabase.from("directory_members").update({ is_allowed: false }).eq("id", existing.id);
    }
    await supabase
      .from("login_access_requests")
      .update({ status: "pending", decided_by: null, decided_at: null })
      .eq("id", req.id);
    setBusyId(null);
    reload();
  };

  // 승인된 외부 계정의 권한 조정 — RLS만으로는 이 화면에서 developer 이외에는 못 쓰게
  // 막기 어려워서(login_access_requests_update_admin이 admin 전체를 허용), DB 함수
  // 안에서 is_superadmin()을 직접 검사하는 RPC로 developer 전용을 강제한다. profiles.role
  // 변경은 audit_profiles_role 트리거가 자동으로 기록한다.
  const changeExternalRole = async (userId: string, newRole: string) => {
    setBusyId(userId);
    const { error } = await supabase.rpc("set_external_account_role", {
      target_user_id: userId,
      new_role: newRole,
    });
    if (error) alert(error.message);
    setBusyId(null);
    reload();
  };

  // 차단된 계정을 "다시 대기 목록에 올리는" 것 — 위 role 변경과 같은 이유로 developer
  // 전용 RPC로 구현한다. directory_members.is_allowed=false + login_access_requests를
  // pending으로 되돌리며, 두 테이블 모두 기존 audit 트리거가 자동으로 기록한다.
  const resetToPending = async (req: LoginAccessRequest) => {
    setBusyId(req.id);
    const { error } = await supabase.rpc("reset_login_access_to_pending", { request_id: req.id });
    if (error) alert(error.message);
    setBusyId(null);
    reload();
  };

  const toggleRestriction = async (checked: boolean) => {
    setTogglingRestriction(true);
    await supabase.from("site_settings").update({ restrict_external_checkin: checked }).eq("id", "default");
    setTogglingRestriction(false);
  };

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  const [deciders, setDeciders] = useState<Record<string, { name: string | null; nickname: string | null; email: string | null }>>({});
  const deciderIds = useMemo(
    () => Array.from(new Set(decided.map((r) => r.decided_by).filter((id): id is string => !!id))),
    [decided]
  );
  useEffect(() => {
    const missing = deciderIds.filter((id) => !(id in deciders));
    if (missing.length === 0) return;
    supabase
      .from("profiles")
      .select("id, name, nickname, email")
      .in("id", missing)
      .then(({ data }) => {
        if (!data) return;
        setDeciders((prev) => {
          const next = { ...prev };
          data.forEach((p) => (next[p.id] = { name: p.name, nickname: p.nickname, email: p.email }));
          return next;
        });
      });
  }, [deciderIds, deciders, supabase]);

  return (
    <div>
      <h2 className="text-[22px] mb-2">외부 계정 관리</h2>
      <p className="text-muted mb-4">
        학교 명단(directory_members)에 없는 이메일로 로그인을 시도하면 이 목록에 기록됩니다.
        "허용"하면 해당 이메일이 명단에 등록되어 다음부터 정상적으로 이용할 수 있고, "차단"하면
        이후 재시도해도 계속 이용이 막힙니다.
      </p>

      {!roleLoading && !canView && (
        <div className="bg-[#FFF3DC] text-gold text-sm rounded-lg p-3 mb-4">
          이 화면은 admin 이상만 열람할 수 있습니다.
        </div>
      )}

      <div className={`${t.adminEditPanel} mb-6`}>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            disabled={!isAdmin || !settings || togglingRestriction}
            checked={settings?.restrict_external_checkin ?? true}
            onChange={(e) => toggleRestriction(e.target.checked)}
          />
          외부 계정 자동 차단 기능 켜기
        </label>
        <p className="text-muted text-xs mt-1.5">
          켜두면(기본값) 학교 명단(directory_members)에 없는 계정은 로그인 시 자동으로
          접근이 차단되어 이 화면에서 개별 승인해야만 이용할 수 있습니다. 꺼두면 차단
          로직 자체를 건너뛰어, 명단에 없는 계정도 학생/교사와 동일하게 바로 이용할 수
          있습니다(체크인 토스트·뱃지 팝업 포함).
        </p>
      </div>

      <h3 className="text-sm font-bold text-muted mb-2">대기 중인 요청 ({pending.length})</h3>
      <AdminTable className="mb-6">
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이메일</th>
            <th className={t.adminTableHeaderCell}>최근 시도</th>
            <th className={`${t.adminTableHeaderCell} w-48`}>처리</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((r) => (
            <tr key={r.id}>
              <td className={t.adminTableCell}>{maskPII ? fakeEmail(r.id) : r.email}</td>
              <td className={`${t.adminTableCell} text-muted`}>
                {new Date(r.attempted_at).toLocaleString("ko-KR")}
              </td>
              <td className={t.adminTableCell}>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => approve(r)}
                    disabled={busyId === r.id}
                    className="bg-teal text-white font-bold text-xs rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    허용
                  </button>
                  <button
                    onClick={() => block(r)}
                    disabled={busyId === r.id}
                    className="bg-red text-white font-bold text-xs rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    차단
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {pending.length === 0 && (
            <tr>
              <td colSpan={3} className="text-muted text-center py-6 text-sm">
                대기 중인 요청이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </AdminTable>

      <h3 className="text-sm font-bold text-muted mb-2">처리 이력 ({decided.length})</h3>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이메일</th>
            <th className={t.adminTableHeaderCell}>최근 시도</th>
            <th className={t.adminTableHeaderCell}>상태</th>
            <th className={`${t.adminTableHeaderCell} w-40`}>권한</th>
            <th className={t.adminTableHeaderCell}>처리 시각</th>
            <th className={t.adminTableHeaderCell}>처리자</th>
            <th className={`${t.adminTableHeaderCell} w-32`} />
          </tr>
        </thead>
        <tbody>
          {decided.map((r) => {
            const label = STATUS_LABEL[r.status];
            const profile = profileByEmail[r.email];
            return (
              <tr key={r.id}>
                <td className={t.adminTableCell}>{maskPII ? fakeEmail(r.id) : r.email}</td>
                <td className={`${t.adminTableCell} text-muted`}>
                  {new Date(r.attempted_at).toLocaleString("ko-KR")}
                </td>
                <td className={`${t.adminTableCell} font-bold ${label.className}`}>{label.text}</td>
                <td className={t.adminTableCell}>
                  {!profile ? (
                    <span className="text-muted text-xs">가입 전</span>
                  ) : r.status === "approved" && isSuperadmin && profile.role !== "superadmin" ? (
                    <select
                      className={t.adminInput}
                      value={profile.role}
                      disabled={busyId === profile.id}
                      onChange={(e) => changeExternalRole(profile.id, e.target.value)}
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>{roleLabel(role)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-muted px-2.5 py-2 inline-block">{roleLabel(profile.role)}</span>
                  )}
                </td>
                <td className={`${t.adminTableCell} text-muted`}>
                  {r.decided_at ? new Date(r.decided_at).toLocaleString("ko-KR") : "-"}
                </td>
                <td className={`${t.adminTableCell} text-muted`}>
                  {r.decided_by ? adminDisplayName(deciders[r.decided_by]) : "-"}
                </td>
                <td className={t.adminTableCell}>
                  <div className="flex flex-col gap-1 items-start">
                    {r.status === "approved" && (
                      <button
                        onClick={() => revokeApproval(r)}
                        disabled={busyId === r.id}
                        className="text-red text-xs font-bold disabled:opacity-50"
                      >
                        다시 막기
                      </button>
                    )}
                    {r.status === "blocked" && (
                      <button
                        onClick={() => unblock(r)}
                        disabled={busyId === r.id}
                        className="text-teal text-xs font-bold disabled:opacity-50"
                      >
                        차단 해제
                      </button>
                    )}
                    {r.status === "blocked" && isSuperadmin && (
                      <button
                        onClick={() => resetToPending(r)}
                        disabled={busyId === r.id}
                        className="text-gold text-xs font-bold disabled:opacity-50"
                      >
                        대기 상태로 되돌리기
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {decided.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted text-center py-6 text-sm">
                처리 이력이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
