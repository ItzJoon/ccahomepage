"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { Member, Organization } from "@/lib/types";

const empty = { org_id: "", name: "", position: "", bio: "", order_index: 1 };

export default function AdminMembersPage() {
  const supabase = createClient();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: members, reload } = useRealtimeList<Member>("members", { orderBy: { column: "order_index" } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });

  const startNew = () => { setForm({ ...empty, org_id: orgs[0]?.id || "" }); setEditing("new"); };
  const startEdit = (m: Member) => {
    setForm({ org_id: m.org_id, name: m.name, position: m.position || "", bio: m.bio || "", order_index: m.order_index });
    setEditing(m.id);
  };

  const save = async () => {
    if (!form.name.trim() || !form.org_id) return;
    if (editing === "new") await supabase.from("members").insert(form);
    else if (editing) await supabase.from("members").update(form).eq("id", editing);
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("members").delete().eq("id", id);
    reload();
  };

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";

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
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">직책</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">소속</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} onClick={() => startEdit(m)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === m.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-sm">{m.name}</td>
                <td className="p-2.5 border-b border-border text-sm">{m.position}</td>
                <td className="p-2.5 border-b border-border text-sm">{orgName(m.org_id)}</td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(e) => { e.stopPropagation(); remove(m.id); }}>삭제</button>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={4} className="text-muted text-center py-8 text-sm">구성원이 없습니다.</td></tr>}
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
          <label className="text-xs font-bold text-muted mt-2">이름</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">직책</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">소개</label>
          <textarea rows={3} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
