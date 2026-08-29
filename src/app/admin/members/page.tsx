"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import AccountPicker, { accountDisplayName } from "@/components/admin/AccountPicker";
import type { Member, Organization, Profile } from "@/lib/types";

type MemberRow = Member & { profile: { profile_image: string | null } | null };

const empty = { org_id: "", user_id: "", name: "", position: "", bio: "", order_index: 1 };

export default function AdminMembersPage() {
  const supabase = createClient();
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

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";

  const linkAccount = (p: Profile) => setForm((f) => ({ ...f, user_id: p.id, name: accountDisplayName(p) }));
  const unlinkAccount = () => setForm((f) => ({ ...f, user_id: "" }));
  const linkedProfile = profiles.find((p) => p.id === form.user_id) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">구성원 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 구성원 추가</button>
        </div>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-14">사진</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">직책</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">소속</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const photo = m.photo_url || m.profile?.profile_image;
              return (
                <tr key={m.id} onClick={() => startEdit(m)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === m.id ? "bg-[#EAF0FB]" : ""}`}>
                  <td className="p-2.5 border-b border-border">
                    {photo ? (
                      <img src={photo} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold">
                        {m.name[0]}
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 border-b border-border text-sm">{m.name}</td>
                  <td className="p-2.5 border-b border-border text-sm">{m.position}</td>
                  <td className="p-2.5 border-b border-border text-sm">{orgName(m.org_id)}</td>
                  <td className="p-2.5 border-b border-border">
                    <button className="text-red text-xs font-bold" onClick={(e) => { e.stopPropagation(); remove(m.id); }}>삭제</button>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">구성원이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "구성원 추가" : "구성원 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">소속 조직</label>
          <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          <label className="text-xs font-bold text-muted mt-2">계정 연결 (선택 — 마이페이지 프로필 사진·이름 연동)</label>
          <AccountPicker profiles={profiles} linkedProfile={linkedProfile} onLink={linkAccount} onUnlink={unlinkAccount} />

          <label className="text-xs font-bold text-muted mt-2">이름</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">직책</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">소개</label>
          <textarea rows={3} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} disabled={!isDirty} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
