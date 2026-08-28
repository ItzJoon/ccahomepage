"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { Profile } from "@/lib/types";

const ROLES = ["student", "teacher", "sub_editor", "editor", "admin", "superadmin"];

export default function AdminUsersPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Profile>("profiles", { orderBy: { column: "created_at", ascending: false } });
  const [q, setQ] = useState("");
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, [supabase]);

  const me = rows.find((p) => p.id === myId);
  const iAmSuperadmin = me?.role === "superadmin";
  const iAmAdmin = iAmSuperadmin || me?.role === "admin";
  const selectableRoles = iAmSuperadmin ? ROLES : ROLES.filter((r) => r !== "admin" && r !== "superadmin");

  const changeRole = async (id: string, role: string) => {
    await supabase.from("profiles").update({ role }).eq("id", id);
    reload();
  };

  const list = rows.filter((p) => (p.email || "").includes(q) || (p.name || "").includes(q));

  return (
    <div>
      <h2 className="text-[22px] mb-2">회원 · 권한 관리</h2>
      <p className="text-muted mb-4">
        신규 가입자는 기본적으로 <code>student</code> 권한으로 생성됩니다. 관리 권한이 필요한 인원만 아래에서 역할을 변경하세요.
        {!iAmAdmin && " editor 등급은 권한을 열람만 할 수 있고, 변경은 admin 이상만 가능합니다."}
        {iAmAdmin && !iAmSuperadmin && " admin 등급은 다른 사용자를 admin/superadmin으로 올릴 수 없고, 이미 admin/superadmin인 계정은 superadmin만 변경할 수 있습니다."}
      </p>
      <input
        className="border border-border rounded-lg px-3 py-2 text-sm mb-3.5 w-full max-w-sm"
        placeholder="이름 또는 이메일 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">이메일</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-40">권한</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const targetIsPrivileged = p.role === "admin" || p.role === "superadmin";
            const canEdit = iAmAdmin && (iAmSuperadmin || !targetIsPrivileged);
            const lockReason = !iAmAdmin
              ? "editor는 권한 열람만 가능합니다. 변경은 admin 이상만 할 수 있습니다."
              : "superadmin만 admin/superadmin 계정의 권한을 변경할 수 있습니다";
            return (
              <tr key={p.id}>
                <td className="p-2.5 border-b border-border text-sm">{p.name || "-"}</td>
                <td className="p-2.5 border-b border-border text-sm">{p.email}</td>
                <td className="p-2.5 border-b border-border">
                  {canEdit ? (
                    <select
                      className="border border-border rounded-lg px-2 py-1 text-sm"
                      value={p.role}
                      onChange={(e) => changeRole(p.id, e.target.value)}
                    >
                      {selectableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-muted" title={lockReason}>
                      {p.role} 🔒
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">사용자가 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
