"use client";

import AdminTable from "./AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import AccountPicker, { accountDisplayName } from "./AccountPicker";
import type { Member, Organization, Profile } from "@/lib/types";

type MemberRow = Member & { profile: { profile_image: string | null } | null };

const empty = { org_id: "", user_id: "", name: "", position: "", bio: "", order_index: 1 };

/**
 * 부서 구성원 관리. 예전에는 /admin/members라는 별도 메뉴였는데, 메인 헤더의
 * "구성원"(학교 전체 명단, /members)과 이름이 겹쳐 헷갈리기 쉬워서 "부서 관리"
 * 화면 안의 탭으로 옮겼다(옛 라우트는 호환을 위해 이 컴포넌트를 그대로 띄운다).
 */
export default function OrgMembersManager() {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: members, reload } = useRealtimeList<MemberRow>("members", {
    select: "*, profile:profiles(profile_image)",
    orderBy: { column: "order_index" },
  });
  const { rows: profiles } = useRealtimeList<Profile>("profiles", { orderBy: { column: "created_at", ascending: false } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const startNew = () => {
    const next = { ...empty, org_id: orgs[0]?.id || "" };
    setForm(next);
    setInitialForm(next);
    setEditing("new");
  };
  const startEdit = (m: MemberRow) => {
    const next = { org_id: m.org_id, user_id: m.user_id || "", name: m.name, position: m.position || "", bio: m.bio || "", order_index: m.order_index };
    setForm(next);
    setInitialForm(next);
    setEditing(m.id);
  };

  const save = async () => {
    if (!form.name.trim() || !form.org_id) return;
    const payload = { ...form, user_id: form.user_id || null };
    if (editing === "new") await supabase.from("members").insert(payload);
    else if (editing) await supabase.from("members").update(payload).eq("id", editing);
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("members").delete().eq("id", id);
    reload();
  };

  // 부서 페이지에 표시되는 순서를 조정한다. order_index는 같은 부서 내에서만 의미가
  // 있으므로(다른 부서 구성원과는 순서를 비교하지 않음), 같은 org_id끼리만 비교해서
  // 이웃과 순서를 맞바꾼다(부서 관리 화면의 move()와 동일한 방식).
  const moveMember = async (m: MemberRow, dir: number) => {
    const sameOrg = [...members].filter((x) => x.org_id === m.org_id).sort((a, b) => a.order_index - b.order_index);
    const idx = sameOrg.findIndex((x) => x.id === m.id);
    const swap = sameOrg[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("members").update({ order_index: swap.order_index }).eq("id", m.id),
      supabase.from("members").update({ order_index: m.order_index }).eq("id", swap.id),
    ]);
    reload();
  };

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";
  const orgOrderIndex = (id: string) => orgs.find((o) => o.id === id)?.order_index ?? Infinity;
  // 화살표로 순서를 바꿀 때 바로 옆자리가 보여야 직관적이므로, 목록도 부서별로 묶어서
  // 그 안에서 order_index 순으로 보여준다(부서 관리 화면의 부서 순서를 그대로 따름).
  const sortedMembers = [...members].sort(
    (a, b) => orgOrderIndex(a.org_id) - orgOrderIndex(b.org_id) || a.order_index - b.order_index
  );

  const linkAccount = (p: Profile) => setForm((f) => ({ ...f, user_id: p.id, name: accountDisplayName(p) }));
  const unlinkAccount = () => setForm((f) => ({ ...f, user_id: "" }));
  const linkedProfile = profiles.find((p) => p.id === form.user_id) || null;

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${editing ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">부서 구성원 관리</h2>
          <button onClick={startNew} className={t.adminBtnPrimary}>+ 구성원 추가</button>
        </div>
        <AdminTable>
          <thead>
            <tr>
              <th className={`${t.adminTableHeaderCell} w-16`}>순서</th>
              <th className={`${t.adminTableHeaderCell} w-14`}>사진</th>
              <th className={t.adminTableHeaderCell}>이름</th>
              <th className={t.adminTableHeaderCell}>직책</th>
              <th className={t.adminTableHeaderCell}>소속</th>
              <th className={`${t.adminTableHeaderCell} w-16`} />
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((m) => {
              const photo = m.photo_url || m.profile?.profile_image;
              return (
                <tr key={m.id} onClick={() => startEdit(m)} className={`cursor-pointer ${t.adminTableRowHover} ${editing === m.id ? t.adminTableRowActive : ""}`}>
                  <td className={t.adminTableCell}>
                    <button className="text-xs text-blue mr-1" onClick={(e) => { e.stopPropagation(); moveMember(m, -1); }}>▲</button>
                    <button className="text-xs text-blue" onClick={(e) => { e.stopPropagation(); moveMember(m, 1); }}>▼</button>
                  </td>
                  <td className={t.adminTableCell}>
                    {photo ? (
                      <img src={photo} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold">
                        {m.name[0]}
                      </div>
                    )}
                  </td>
                  <td className={t.adminTableCell}>{m.name}</td>
                  <td className={t.adminTableCell}>{m.position}</td>
                  <td className={t.adminTableCell}>{orgName(m.org_id)}</td>
                  <td className={t.adminTableCell}>
                    <button className={t.adminBtnDanger} onClick={(e) => { e.stopPropagation(); remove(m.id); }}>삭제</button>
                  </td>
                </tr>
              );
            })}
            {sortedMembers.length === 0 && <tr><td colSpan={6} className="text-muted text-center py-8 text-sm">구성원이 없습니다.</td></tr>}
          </tbody>
        </AdminTable>
      </div>
      {editing && (
        <div className={`${t.adminEditPanel} flex flex-col gap-1.5 sticky top-20`}>
          <h3>{editing === "new" ? "구성원 추가" : "구성원 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">소속 부서</label>
          <select className={t.adminInput} value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          <label className="text-xs font-bold text-muted mt-2">계정 연결 (선택 — 마이페이지 프로필 사진·이름 연동)</label>
          <AccountPicker profiles={profiles} linkedProfile={linkedProfile} onLink={linkAccount} onUnlink={unlinkAccount} />

          <label className="text-xs font-bold text-muted mt-2">이름</label>
          <input className={t.adminInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">직책</label>
          <input className={t.adminInput} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">소개</label>
          <textarea rows={3} className={t.adminInput} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} disabled={!isDirty} className={`${t.adminBtnPrimary} disabled:opacity-40 disabled:cursor-not-allowed`}>저장</button>
            <button onClick={() => setEditing(null)} className={t.adminBtnSecondary}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
