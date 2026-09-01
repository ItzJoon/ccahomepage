"use client";

import Link from "next/link";
import AdminTable from "@/components/admin/AdminTable";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { Profile, DirectoryMember } from "@/lib/types";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

/**
 * 일시정지 중인 계정(profiles.suspended_until이 미래)과 차단된 계정(directory_members.
 * is_allowed=false)을 한 화면에서 한눈에 볼 수 있게 모은 목록. 개별 계정의 상세 조치
 * (경고 이력, 정지 기간 조정 등)는 여전히 구성원 프로필의 ModerationPanel에서 하고,
 * 여기서는 "지금 누가 막혀 있는지"를 빠르게 확인하고 그 자리에서 바로 해제만 할 수 있다.
 */
export default function AdminModerationPage() {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const { isAdmin: iAmAdmin, role, loading: roleLoading } = useMyRole();
  const canView = iAmAdmin || role === "designer";
  // 정지 해제(unsuspend_user RPC)는 designer도 쓸 수 있게 확장돼 있지만(다른 admin 전용
  // 화면과 동일한 write parity), 차단 해제(directory_members 직접 update)는 여전히
  // is_admin() 전용이라 designer는 그 버튼은 못 쓴다 — RLS 범위와 정확히 맞춘다.
  const canModerate = iAmAdmin || role === "designer";

  const { rows: profiles, reload: reloadProfiles } = useRealtimeList<Profile>("profiles", {
    orderBy: { column: "created_at", ascending: false },
  });
  const { rows: directory, reload: reloadDirectory } = useRealtimeList<DirectoryMember>("directory_members");

  const suspended = profiles
    .filter((p) => p.suspended_until && new Date(p.suspended_until).getTime() > Date.now())
    .sort((a, b) => new Date(a.suspended_until!).getTime() - new Date(b.suspended_until!).getTime());

  const banned = directory.filter((d) => !d.is_allowed);
  const profileByEmail = Object.fromEntries(profiles.map((p) => [p.email, p]));

  const unsuspend = async (id: string) => {
    const { error } = await supabase.rpc("unsuspend_user", { target_user_id: id });
    if (!error) reloadProfiles();
  };

  const unban = async (id: string) => {
    await supabase.from("directory_members").update({ is_allowed: true }).eq("id", id);
    reloadDirectory();
  };

  return (
    <div>
      <h2 className="text-[22px] mb-2">정지 · 차단 계정</h2>
      <p className="text-muted mb-4">
        현재 일시정지 중이거나 명단에서 차단된 계정을 한 곳에서 확인하고 바로 해제할 수 있습니다.
        경고 이력이나 정지 기간 조정 등 상세 조치는 구성원 프로필에서 할 수 있습니다.
      </p>

      {!roleLoading && !canView && (
        <div className="bg-[#FFF3DC] text-gold text-sm rounded-lg p-3 mb-4">이 화면은 admin 이상만 열람할 수 있습니다.</div>
      )}

      <h3 className="text-base font-bold mb-2">일시정지 중 ({suspended.length})</h3>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이름</th>
            <th className={t.adminTableHeaderCell}>이메일</th>
            <th className={`${t.adminTableHeaderCell} w-24`}>경고 횟수</th>
            <th className={`${t.adminTableHeaderCell} w-48`}>정지 해제 시각</th>
            <th className={`${t.adminTableHeaderCell} w-24`} />
          </tr>
        </thead>
        <tbody>
          {suspended.map((p) => (
            <tr key={p.id}>
              <td className={t.adminTableCell}>
                <Link href={`/members/${p.id}`} className="text-blue font-bold">
                  {p.nickname || p.name || "이름 없음"}
                </Link>
              </td>
              <td className={t.adminTableCell}>{p.email}</td>
              <td className={t.adminTableCell}>{p.warning_count}</td>
              <td className={t.adminTableCell}>{fmtDateTime(p.suspended_until!)}</td>
              <td className={t.adminTableCell}>
                {canModerate && (
                  <button onClick={() => unsuspend(p.id)} className={t.adminBtnSecondary}>
                    정지 해제
                  </button>
                )}
              </td>
            </tr>
          ))}
          {suspended.length === 0 && (
            <tr><td colSpan={5} className="text-muted text-center py-6 text-sm">현재 일시정지 중인 계정이 없습니다.</td></tr>
          )}
        </tbody>
      </AdminTable>

      <h3 className="text-base font-bold mb-2 mt-6">차단된 계정 ({banned.length})</h3>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이름 · 이메일</th>
            <th className={`${t.adminTableHeaderCell} w-28`}>구분</th>
            <th className={`${t.adminTableHeaderCell} w-24`} />
          </tr>
        </thead>
        <tbody>
          {banned.map((d) => {
            const linkedProfile = profileByEmail[d.email];
            return (
              <tr key={d.id}>
                <td className={t.adminTableCell}>
                  {linkedProfile ? (
                    <Link href={`/members/${linkedProfile.id}`} className="text-blue font-bold">
                      {linkedProfile.nickname || linkedProfile.name || d.display_name}
                    </Link>
                  ) : (
                    d.display_name
                  )}
                  <span className="text-muted"> · {d.email}</span>
                </td>
                <td className={t.adminTableCell}>
                  {d.member_type === "student" ? "학생" : d.member_type === "teacher" ? "교사" : "외부 계정"}
                </td>
                <td className={t.adminTableCell}>
                  {iAmAdmin && (
                    <button onClick={() => unban(d.id)} className={t.adminBtnSecondary}>
                      차단 해제
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {banned.length === 0 && (
            <tr><td colSpan={3} className="text-muted text-center py-6 text-sm">현재 차단된 계정이 없습니다.</td></tr>
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
