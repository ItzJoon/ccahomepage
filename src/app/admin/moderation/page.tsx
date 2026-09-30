"use client";

import Link from "next/link";
import AdminTable from "@/components/admin/AdminTable";
import { createClient } from "@/lib/supabase/client";
import { useList } from "@/hooks/useList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { adminDisplayName } from "@/lib/displayName";
import type { Profile, DirectoryMember } from "@/lib/types";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

/**
 * 정지(글쓰기만 제한, is_suspended)와 차단(사이트 접속 자체 불가, directory_members.
 * is_allowed=false)은 완전히 다른 제재라 헷갈리지 않도록 "일시 정지 / 영구 정지 / 영구
 * 차단" 세 섹션으로 나눠서 보여준다. 개별 계정의 상세 조치(경고 이력 등)는 여전히
 * 구성원 프로필의 ModerationPanel에서 하고, 여기서는 "지금 누가 막혀 있는지"를 한눈에
 * 확인하고 그 자리에서 바로 해제만 할 수 있다.
 */
export default function AdminModerationPage() {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const { isAdmin: iAmAdmin, role, loading: roleLoading } = useMyRole();
  const canView = iAmAdmin || role === "designer";
  const canModerate = iAmAdmin || role === "designer";

  const { rows: profiles, reload: reloadProfiles } = useList<Profile>("profiles", {
    orderBy: { column: "created_at", ascending: false },
  });
  const { rows: directory, reload: reloadDirectory } = useList<DirectoryMember>("directory_members");

  // is_currently_suspended()와 동일한 기준(플래그 + 아직 안 지난 시각)으로 걸러서, 일시
  // 정지가 자동으로 풀린 것처럼 보이도록 한다(배치 작업 없이 매 렌더링 시점 기준).
  const currentlySuspended = profiles.filter(
    (p) => p.is_suspended && (!p.suspended_until || new Date(p.suspended_until).getTime() > Date.now())
  );
  const temporarilySuspended = currentlySuspended
    .filter((p) => p.suspended_until)
    .sort((a, b) => new Date(a.suspended_until!).getTime() - new Date(b.suspended_until!).getTime());
  const permanentlySuspended = currentlySuspended.filter((p) => !p.suspended_until);

  // 학교 명단(학생/교사)만 대상으로 한다 — directory_members에는 "외부 계정 관리"에서
  // 별도로 다루는 외부 계정(member_type='other')도 섞여 있어서, 그쪽은 제외한다.
  const banned = directory.filter((d) => !d.is_allowed && d.member_type !== "other");
  const profileByEmail = Object.fromEntries(profiles.map((p) => [p.email, p]));

  const unsuspend = async (id: string) => {
    const { error } = await supabase.rpc("unsuspend_user", { target_user_id: id });
    if (!error) reloadProfiles();
  };

  // directory_members를 직접 update하면 ban_reason이 안 지워지고 audit_logs도 안 남는다
  // (예전 버그) — RPC로 통일해서 항상 같은 방식으로 해제되게 한다. 계정이 이미 있으면
  // uid 기준 RPC를, 아직 가입 전(profiles 행 없음)이면 이메일 기준 RPC를 쓴다.
  const unban = async (email: string, profileId: string | undefined) => {
    const { error } = profileId
      ? await supabase.rpc("unban_user_permanently", { target_user_id: profileId })
      : await supabase.rpc("unban_by_email", { target_email: email });
    if (!error) {
      reloadDirectory();
      reloadProfiles();
    }
  };

  return (
    <div>
      <h2 className="text-[22px] mb-2">정지 · 차단 계정</h2>
      <p className="text-muted mb-4">
        <strong>정지</strong>는 글쓰기(공지·게시판·Q&A·안건·투표 등)만 막고 열람은 그대로 됩니다. <strong>차단</strong>은 로그인해도
        사이트 접속 자체가 안 됩니다. 경고 이력이나 세부 조치는 구성원 프로필에서 할 수 있습니다.
      </p>

      {!roleLoading && !canView && (
        <div className="bg-[#FFF3DC] dark:bg-white/10 text-gold text-sm rounded-lg p-3 mb-4">이 화면은 admin 이상만 열람할 수 있습니다.</div>
      )}

      <h3 className="text-base font-bold mb-2">일시 정지 중 ({temporarilySuspended.length})</h3>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이름</th>
            <th className={t.adminTableHeaderCell}>이메일</th>
            <th className={`${t.adminTableHeaderCell} w-24`}>경고 횟수</th>
            <th className={t.adminTableHeaderCell}>사유</th>
            <th className={`${t.adminTableHeaderCell} w-48`}>자동 해제 시각</th>
            <th className={`${t.adminTableHeaderCell} w-24`} />
          </tr>
        </thead>
        <tbody>
          {temporarilySuspended.map((p) => (
            <tr key={p.id}>
              <td className={t.adminTableCell}>
                <Link href={`/members/${p.id}`} className="text-blue font-bold">
                  {adminDisplayName(p, "이름 없음")}
                </Link>
              </td>
              <td className={t.adminTableCell}>{p.email}</td>
              <td className={t.adminTableCell}>{p.warning_count}</td>
              <td className={`${t.adminTableCell} text-muted`}>{p.suspended_reason || "-"}</td>
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
          {temporarilySuspended.length === 0 && (
            <tr><td colSpan={6} className="text-muted text-center py-6 text-sm">현재 일시 정지 중인 계정이 없습니다.</td></tr>
          )}
        </tbody>
      </AdminTable>

      <h3 className="text-base font-bold mb-2 mt-6">영구 정지 중 ({permanentlySuspended.length})</h3>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이름</th>
            <th className={t.adminTableHeaderCell}>이메일</th>
            <th className={`${t.adminTableHeaderCell} w-24`}>경고 횟수</th>
            <th className={t.adminTableHeaderCell}>사유</th>
            <th className={`${t.adminTableHeaderCell} w-24`} />
          </tr>
        </thead>
        <tbody>
          {permanentlySuspended.map((p) => (
            <tr key={p.id}>
              <td className={t.adminTableCell}>
                <Link href={`/members/${p.id}`} className="text-blue font-bold">
                  {adminDisplayName(p, "이름 없음")}
                </Link>
              </td>
              <td className={t.adminTableCell}>{p.email}</td>
              <td className={t.adminTableCell}>{p.warning_count}</td>
              <td className={`${t.adminTableCell} text-muted`}>{p.suspended_reason || "-"}</td>
              <td className={t.adminTableCell}>
                {canModerate && (
                  <button onClick={() => unsuspend(p.id)} className={t.adminBtnSecondary}>
                    정지 해제
                  </button>
                )}
              </td>
            </tr>
          ))}
          {permanentlySuspended.length === 0 && (
            <tr><td colSpan={5} className="text-muted text-center py-6 text-sm">현재 영구 정지 중인 계정이 없습니다.</td></tr>
          )}
        </tbody>
      </AdminTable>

      <h3 className="text-base font-bold mb-2 mt-6">영구 차단된 계정 ({banned.length})</h3>
      <AdminTable>
        <thead>
          <tr>
            <th className={t.adminTableHeaderCell}>이름 · 이메일</th>
            <th className={`${t.adminTableHeaderCell} w-28`}>구분</th>
            <th className={t.adminTableHeaderCell}>사유</th>
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
                      {adminDisplayName(linkedProfile, d.display_name)}
                    </Link>
                  ) : (
                    d.display_name
                  )}
                  <span className="text-muted"> · {d.email}</span>
                </td>
                <td className={t.adminTableCell}>
                  {d.member_type === "student" ? "학생" : d.member_type === "teacher" ? "교사" : "외부 계정"}
                </td>
                <td className={`${t.adminTableCell} text-muted`}>{d.ban_reason || "-"}</td>
                <td className={t.adminTableCell}>
                  {iAmAdmin && (
                    <button onClick={() => unban(d.email, linkedProfile?.id)} className={t.adminBtnSecondary}>
                      차단 해제
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {banned.length === 0 && (
            <tr><td colSpan={4} className="text-muted text-center py-6 text-sm">현재 차단된 계정이 없습니다.</td></tr>
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
