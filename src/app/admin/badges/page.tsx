"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { BadgeDef } from "@/lib/types";

const empty = { code: "", label: "", description: "", icon: "🏅", streak_threshold: 3, order_index: 0, is_active: true };

export default function AdminBadgesPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<BadgeDef>("badges", { orderBy: { column: "streak_threshold" } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });

  const startNew = () => {
    setForm({ ...empty, order_index: rows.length + 1 });
    setEditing("new");
  };
  const startEdit = (b: BadgeDef) => {
    setForm({
      code: b.code,
      label: b.label,
      description: b.description || "",
      icon: b.icon,
      streak_threshold: b.streak_threshold,
      order_index: b.order_index,
      is_active: b.is_active,
    });
    setEditing(b.id);
  };

  const save = async () => {
    if (!form.code.trim() || !form.label.trim() || form.streak_threshold <= 0) return;
    if (editing === "new") await supabase.from("badges").insert(form);
    else if (editing) await supabase.from("badges").update(form).eq("id", editing);
    setEditing(null);
    reload();
  };

  const toggleActive = async (b: BadgeDef) => {
    await supabase.from("badges").update({ is_active: !b.is_active }).eq("id", b.id);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 뱃지를 삭제하면 이미 획득한 학생 기록도 함께 삭제됩니다. 계속할까요?")) return;
    await supabase.from("badges").delete().eq("id", id);
    reload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">뱃지 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 뱃지 추가</button>
        </div>
        <p className="text-muted mb-4 text-sm">
          연속 접속일수(스트릭)가 조건에 도달하면 학생에게 자동으로 지급됩니다. 비활성화하면 신규 지급만 멈추고, 이미 받은 학생의 뱃지는 유지됩니다.
        </p>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-14">아이콘</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">조건(일)</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">상태</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => a.streak_threshold - b.streak_threshold).map((b) => (
              <tr key={b.id} onClick={() => startEdit(b)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === b.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-xl">{b.icon}</td>
                <td className="p-2.5 border-b border-border text-sm">
                  <div className="font-bold">{b.label}</div>
                  <div className="text-muted text-xs">{b.description}</div>
                </td>
                <td className="p-2.5 border-b border-border text-sm">{b.streak_threshold}일</td>
                <td className="p-2.5 border-b border-border">
                  <button
                    className={`text-xs font-bold ${b.is_active ? "text-teal" : "text-muted"}`}
                    onClick={(e) => { e.stopPropagation(); toggleActive(b); }}
                  >
                    {b.is_active ? "활성" : "비활성"}
                  </button>
                </td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(e) => { e.stopPropagation(); remove(b.id); }}>삭제</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 뱃지가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "뱃지 추가" : "뱃지 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">코드 (영문, 고유값)</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="예: streak_14" />
          <label className="text-xs font-bold text-muted mt-2">아이콘 (이모지 1자)</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">뱃지 이름</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">설명</label>
          <textarea rows={2} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">달성 조건 (연속 접속 일수)</label>
          <input
            type="number"
            min={1}
            className="border border-border rounded-lg px-2.5 py-2 text-sm"
            value={form.streak_threshold}
            onChange={(e) => setForm({ ...form, streak_threshold: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            활성화 (학생에게 지급)
          </label>
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
