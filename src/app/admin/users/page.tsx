"use client";

import AdminTable from "@/components/admin/AdminTable";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { DirectoryMember, Profile } from "@/lib/types";

const ROLES = ["student", "viewer", "teacher", "sub_editor", "editor", "admin", "superadmin", "designer"];
const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };

export default function AdminUsersPage() {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const { rows, reload } = useRealtimeList<Profile>("profiles", { orderBy: { column: "created_at", ascending: false } });
  const { rows: directory } = useRealtimeList<DirectoryMember>("directory_members");
  const [q, setQ] = useState("");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, [supabase]);

  const directoryByEmail = useMemo(
    () => Object.fromEntries(directory.map((d) => [d.email, d])),
    [directory]
  );

  const me = rows.find((p) => p.id === myId);
  const iAmSuperadmin = me?.role === "superadmin";
  const iAmAdmin = iAmSuperadmin || me?.role === "admin";
  const iAmDesigner = me?.role === "designer";
  // designer(조회 전용) 옵션은 superadmin 계정에게만 보인다 — admin은 이 역할 자체를
  // 부여할 수 없다(요건: admin에게는 안 보임).
  const selectableRoles = iAmSuperadmin ? ROLES : ROLES.filter((r) => r !== "admin" && r !== "superadmin" && r !== "designer");

  const changeRole = async (id: string, role: string) => {
    await supabase.from("profiles").update({ role }).eq("id", id);
    reload();
  };

  const toggleFlag = async (id: string, field: "is_council" | "is_judiciary", value: boolean) => {
    await supabase.from("profiles").update({ [field]: value }).eq("id", id);
    reload();
  };

  const list = rows
    .filter((p) => (p.email || "").includes(q) || (p.name || "").includes(q))
    .filter((p) => {
      if (gradeFilter === "전체") return true;
      const dm = directoryByEmail[p.email];
      return dm?.member_type === "student" && dm.grade === gradeFilter;
    });

  return (
    <div>
      <h2 className="text-[22px] mb-2">회원 · 권한 관리</h2>
      <p className="text-muted mb-4">
        신규 가입자는 기본적으로 <code>student</code> 권한으로 생성됩니다. 관리 권한이 필요한 인원만 아래에서 역할을 변경하세요.
        {!iAmAdmin && " editor 등급은 권한을 열람만 할 수 있고, 변경은 admin 이상만 가능합니다."}
        {iAmAdmin && !iAmSuperadmin && " admin 등급은 다른 사용자를 admin/superadmin으로 올릴 수 없고, 이미 admin/superadmin인 계정은 superadmin만 변경할 수 있습니다."}
      </p>
      <div className="flex gap-2 mb-3.5">
        <input
          className={`${t.adminInput} w-full max-w-sm`}
          placeholder="이름 또는 이메일 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={t.adminInput}
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
        >
          <option value="전체">학년 전체</option>
          <option value="10">10학년</option>
          <option value="11">11학년</option>
          <option value="12">12학년</option>
        </select>
      </div>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이름</th>
            <th className={t.adminTableHeaderCell}>이메일</th>
            <th className={t.adminTableHeaderCell}>명단 정보</th>
            <th className={`${t.adminTableHeaderCell} w-40`}>권한</th>
            <th className={`${t.adminTableHeaderCell} w-20`}>임원회</th>
            <th className={`${t.adminTableHeaderCell} w-20`}>사법위원회</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const targetIsPrivileged = p.role === "admin" || p.role === "superadmin";
            const canEdit = iAmAdmin && (iAmSuperadmin || !targetIsPrivileged);
            const lockReason = !iAmAdmin
              ? "editor는 권한 열람만 가능합니다. 변경은 admin 이상만 할 수 있습니다."
              : "superadmin만 admin/superadmin 계정의 권한을 변경할 수 있습니다";
            const dm = directoryByEmail[p.email];
            return (
              <tr key={p.id}>
                <td className={t.adminTableCell}>{p.name || "-"}</td>
                <td className={t.adminTableCell}>{p.email}</td>
                <td className={`${t.adminTableCell} text-muted`}>
                  {!dm && "-"}
                  {dm?.member_type === "student" &&
                    `학생 · ${dm.grade}학년 ${dm.homeroom ? HOMEROOM_LABEL[dm.homeroom] : ""}`}
                  {dm?.member_type === "teacher" && `교사 · ${dm.subject || "-"}`}
                  {dm?.member_type === "other" && "외부 승인 계정"}
                </td>
                <td className={t.adminTableCell}>
                  {canEdit || iAmDesigner ? (
                    // designer는 어차피 아무것도 바꿀 수 없지만(DesignerModeGate + RLS가
                    // 이중으로 막음), 요건상 입력 요소 자체는 감추지 않고 disabled로만
                    // 보여준다 — 편집 가능한 다른 계정과 화면 구조가 동일하게 보인다.
                    <select
                      className={t.adminInput}
                      value={p.role}
                      disabled={!canEdit}
                      onChange={(e) => changeRole(p.id, e.target.value)}
                    >
                      {/* disabled(designer 열람 전용)일 때는 표시 중인 role이 selectableRoles에
                          없어도(예: designer가 admin 계정의 행을 보는 경우) value가 옵션 목록에
                          없어서 빈 값으로 보이지 않도록 전체 ROLES를 옵션으로 쓴다. */}
                      {(canEdit ? selectableRoles : ROLES).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-muted" title={lockReason}>
                      {p.role} 🔒
                    </span>
                  )}
                </td>
                <td className={`${t.adminTableCell} text-center`}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={p.is_council}
                    onChange={(e) => toggleFlag(p.id, "is_council", e.target.checked)}
                  />
                </td>
                <td className={`${t.adminTableCell} text-center`}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={p.is_judiciary}
                    onChange={(e) => toggleFlag(p.id, "is_judiciary", e.target.checked)}
                  />
                </td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={6} className="text-muted text-center py-8 text-sm">사용자가 없습니다.</td></tr>}
        </tbody>
      </AdminTable>
    </div>
  );
}
