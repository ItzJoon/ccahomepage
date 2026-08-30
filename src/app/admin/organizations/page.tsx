"use client";

import AdminTable from "@/components/admin/AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";
import AccountPicker, { accountDisplayName } from "@/components/admin/AccountPicker";
import type { Member, Organization, Profile } from "@/lib/types";

type MemberRow = Member & { profile: { profile_image: string | null } | null };

const COLORS = ["navy", "teal", "red", "gold"];
const empty = { name: "", slug: "", color: "navy", description: "", role_description: "", order_index: 0 };
const emptyMember = { user_id: "", name: "", position: "" };

export default function AdminOrganizationsPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: members } = useRealtimeList<MemberRow>("members", {
    select: "*, profile:profiles(profile_image)",
    orderBy: { column: "order_index" },
  });
  const { rows: profiles } = useRealtimeList<Profile>("profiles", { orderBy: { column: "created_at", ascending: false } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const [addingMember, setAddingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ ...emptyMember });

  const startNew = () => {
    const next = { ...empty, order_index: rows.length + 1 };
    setForm(next);
    setInitialForm(next);
    setAddingMember(false);
    setMemberForm({ ...emptyMember });
    setEditing("new");
  };
  const startEdit = (o: Organization) => {
    const next = { name: o.name, slug: o.slug, color: o.color, description: o.description || "", role_description: o.role_description || "", order_index: o.order_index };
    setForm(next);
    setInitialForm(next);
    setAddingMember(false);
    setMemberForm({ ...emptyMember });
    setEditing(o.id);
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    if (editing === "new") await supabase.from("organizations").insert(form);
    else if (editing) await supabase.from("organizations").update(form).eq("id", editing);
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 조직과 소속 구성원이 모두 삭제됩니다. 계속할까요?")) return;
    await supabase.from("organizations").delete().eq("id", id);
    reload();
  };

  const move = async (o: Organization, dir: number) => {
    const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex((x) => x.id === o.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("organizations").update({ order_index: swap.order_index }).eq("id", o.id),
      supabase.from("organizations").update({ order_index: o.order_index }).eq("id", swap.id),
    ]);
    reload();
  };

  const orgMembers = editing && editing !== "new" ? members.filter((m) => m.org_id === editing) : [];

  const addMember = async () => {
    if (!memberForm.name.trim() || !editing || editing === "new") return;
    await supabase.from("members").insert({
      org_id: editing,
      user_id: memberForm.user_id || null,
      name: memberForm.name.trim(),
      position: memberForm.position.trim() || null,
      order_index: orgMembers.length + 1,
    });
    setMemberForm({ ...emptyMember });
    setAddingMember(false);
  };

  const removeMember = async (id: string) => {
    if (!confirm("이 구성원을 삭제하시겠습니까?")) return;
    await supabase.from("members").delete().eq("id", id);
  };

  const linkMemberAccount = (p: Profile) => setMemberForm((f) => ({ ...f, user_id: p.id, name: accountDisplayName(p) }));
  const unlinkMemberAccount = () => setMemberForm((f) => ({ ...f, user_id: "" }));
  const linkedMemberProfile = profiles.find((p) => p.id === memberForm.user_id) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">조직 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 조직 추가</button>
        </div>
        <AdminTable>
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16">순서</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">조직명</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => a.order_index - b.order_index).map((o) => (
              <tr key={o.id} onClick={() => startEdit(o)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === o.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border">
                  <button className="text-xs text-blue mr-1" onClick={(e) => { e.stopPropagation(); move(o, -1); }}>▲</button>
                  <button className="text-xs text-blue" onClick={(e) => { e.stopPropagation(); move(o, 1); }}>▼</button>
                </td>
                <td className="p-2.5 border-b border-border"><Badge color={o.color}>{o.name}</Badge></td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(e) => { e.stopPropagation(); remove(o.id); }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "조직 추가" : "조직 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">조직명</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">슬러그 (URL, 영문)</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="예: exec" />
          <label className="text-xs font-bold text-muted mt-2">색상 태그</label>
          <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
            {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">소개</label>
          <textarea rows={3} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">주요 역할</label>
          <textarea rows={3} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.role_description} onChange={(e) => setForm({ ...form, role_description: e.target.value })} />
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} disabled={!isDirty} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>

          {editing === "new" ? (
            <p className="text-muted text-xs border-t border-border mt-4 pt-4">저장 후 이 조직에 구성원을 추가할 수 있습니다.</p>
          ) : (
            <div className="border-t border-border mt-4 pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-bold">소속 구성원 ({orgMembers.length})</h4>
                <button
                  type="button"
                  onClick={() => setAddingMember((v) => !v)}
                  className="text-xs font-bold text-blue"
                >
                  {addingMember ? "닫기" : "+ 구성원 추가"}
                </button>
              </div>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5 mb-2 max-h-56 overflow-auto">
                {orgMembers.map((m) => {
                  const photo = m.photo_url || m.profile?.profile_image;
                  return (
                    <li key={m.id} className="flex items-center gap-2 text-sm border border-border rounded-lg px-2 py-1.5">
                      {photo ? (
                        <img src={photo} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {m.name[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-bold">{m.name}</div>
                        {m.position && <div className="text-muted text-xs truncate">{m.position}</div>}
                      </div>
                      <button type="button" onClick={() => removeMember(m.id)} className="text-red text-xs font-bold shrink-0">삭제</button>
                    </li>
                  );
                })}
                {orgMembers.length === 0 && <li className="text-muted text-xs text-center py-3">구성원이 없습니다.</li>}
              </ul>
              {addingMember && (
                <div className="border border-border rounded-lg p-2.5 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted">계정 연결 (선택)</label>
                  <AccountPicker
                    profiles={profiles}
                    linkedProfile={linkedMemberProfile}
                    onLink={linkMemberAccount}
                    onUnlink={unlinkMemberAccount}
                  />
                  <label className="text-xs font-bold text-muted mt-1">이름</label>
                  <input
                    className="border border-border rounded-lg px-2.5 py-2 text-sm"
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  />
                  <label className="text-xs font-bold text-muted mt-1">직책</label>
                  <input
                    className="border border-border rounded-lg px-2.5 py-2 text-sm"
                    value={memberForm.position}
                    onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value })}
                  />
                  <button type="button" onClick={addMember} className="bg-gold text-white font-bold text-xs rounded-lg px-3 py-2 mt-1">
                    구성원 추가
                  </button>
                  <p className="text-muted text-[11px]">소개글 등 세부 정보는 구성원 관리 화면에서 추가로 입력할 수 있습니다.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
