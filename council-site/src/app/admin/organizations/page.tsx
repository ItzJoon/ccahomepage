"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";
import type { Organization } from "@/lib/types";

const COLORS = ["navy", "teal", "red", "gold"];
const empty = { name: "", slug: "", color: "navy", description: "", role_description: "", order_index: 0 };

export default function AdminOrganizationsPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });

  const startNew = () => { setForm({ ...empty, order_index: rows.length + 1 }); setEditing("new"); };
  const startEdit = (o: Organization) => {
    setForm({ name: o.name, slug: o.slug, color: o.color, description: o.description || "", role_description: o.role_description || "", order_index: o.order_index });
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">조직 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 조직 추가</button>
        </div>
        <table className="w-full border-collapse bg-white">
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
        </table>
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
            <button onClick={save} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
