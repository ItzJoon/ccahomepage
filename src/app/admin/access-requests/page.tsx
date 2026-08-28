"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { LoginAccessRequest } from "@/lib/types";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "대기 중", className: "text-gold" },
  approved: { text: "허용됨", className: "text-teal" },
  blocked: { text: "차단됨", className: "text-red" },
};

export default function AdminAccessRequestsPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<LoginAccessRequest>("login_access_requests", {
    orderBy: { column: "attempted_at", ascending: false },
  });
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setMyId(data.user?.id ?? null);
      if (!data.user) {
        setIsAdmin(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIsAdmin(!!profile && ["admin", "superadmin"].includes(profile.role));
    });
  }, [supabase]);

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

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div>
      <h2 className="text-[22px] mb-2">외부 계정 관리</h2>
      <p className="text-muted mb-4">
        학교 명단(directory_members)에 없는 이메일로 로그인을 시도하면 이 목록에 기록됩니다.
        "허용"하면 해당 이메일이 명단에 등록되어 다음부터 정상적으로 이용할 수 있고, "차단"하면
        이후 재시도해도 계속 이용이 막힙니다.
      </p>

      {isAdmin === false && (
        <div className="bg-[#FFF3DC] text-gold text-sm rounded-lg p-3 mb-4">
          이 화면은 admin 이상만 열람할 수 있습니다.
        </div>
      )}

      <h3 className="text-sm font-bold text-muted mb-2">대기 중인 요청 ({pending.length})</h3>
      <table className="w-full border-collapse bg-white mb-6">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">이메일</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">최근 시도</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-48">처리</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((r) => (
            <tr key={r.id}>
              <td className="p-2.5 border-b border-border text-sm">{r.email}</td>
              <td className="p-2.5 border-b border-border text-sm text-muted">
                {new Date(r.attempted_at).toLocaleString("ko-KR")}
              </td>
              <td className="p-2.5 border-b border-border">
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
      </table>

      <h3 className="text-sm font-bold text-muted mb-2">처리 이력 ({decided.length})</h3>
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">이메일</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">최근 시도</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">상태</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">처리 시각</th>
          </tr>
        </thead>
        <tbody>
          {decided.map((r) => {
            const label = STATUS_LABEL[r.status];
            return (
              <tr key={r.id}>
                <td className="p-2.5 border-b border-border text-sm">{r.email}</td>
                <td className="p-2.5 border-b border-border text-sm text-muted">
                  {new Date(r.attempted_at).toLocaleString("ko-KR")}
                </td>
                <td className={`p-2.5 border-b border-border text-sm font-bold ${label.className}`}>{label.text}</td>
                <td className="p-2.5 border-b border-border text-sm text-muted">
                  {r.decided_at ? new Date(r.decided_at).toLocaleString("ko-KR") : "-"}
                </td>
              </tr>
            );
          })}
          {decided.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted text-center py-6 text-sm">
                처리 이력이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
