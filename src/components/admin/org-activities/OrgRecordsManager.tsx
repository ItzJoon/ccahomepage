"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";
import type { Organization, OrgRecord } from "@/lib/types";

const CATEGORY_LABEL: Record<OrgRecord["category"], string> = {
  notice: "공지",
  activity: "활동",
  minutes: "회의록",
};
const CATEGORY_COLOR: Record<OrgRecord["category"], "navy" | "teal" | "gold"> = {
  notice: "navy",
  activity: "teal",
  minutes: "gold",
};

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

const empty = { org_id: "", category: "notice" as OrgRecord["category"], title: "", content: "" };

export default function OrgRecordsManager() {
  const supabase = createClient();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: records, reload } = useRealtimeList<OrgRecord>("org_records", { orderBy: { column: "created_at", ascending: false } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const [error, setError] = useState<string | null>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";

  const startNew = () => {
    const next = { ...empty, org_id: orgs[0]?.id || "" };
    setForm(next);
    setInitialForm(next);
    setError(null);
    setEditing("new");
  };
  const startEdit = (r: OrgRecord) => {
    const next = { org_id: r.org_id, category: r.category, title: r.title, content: r.content };
    setForm(next);
    setInitialForm(next);
    setError(null);
    setEditing(r.id);
  };

  const save = async () => {
    setError(null);
    if (!form.org_id || !form.title.trim() || !form.content.trim()) {
      setError("소속 조직, 제목, 내용을 모두 입력해 주세요.");
      return;
    }
    if (editing === "new") {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("org_records").insert({ ...form, author_id: user?.id });
    } else if (editing) {
      await supabase.from("org_records").update(form).eq("id", editing);
    }
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 기록을 삭제하시겠습니까?")) return;
    await supabase.from("org_records").delete().eq("id", id);
    if (editing === id) setEditing(null);
    reload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">조직 활동 · 활동기록 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 기록 작성</button>
        </div>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">조직</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">분류</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">작성일</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} onClick={() => startEdit(r)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === r.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-sm">{r.title}</td>
                <td className="p-2.5 border-b border-border text-sm">{orgName(r.org_id)}</td>
                <td className="p-2.5 border-b border-border"><Badge color={CATEGORY_COLOR[r.category]}>{CATEGORY_LABEL[r.category]}</Badge></td>
                <td className="p-2.5 border-b border-border text-sm">{fmt(r.created_at)}</td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>삭제</button>
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 기록이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "기록 작성" : "기록 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">소속 조직</label>
          <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
            <option value="">조직을 선택하세요</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">분류</label>
          <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as OrgRecord["category"] })}>
            {Object.entries(CATEGORY_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">제목</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">내용</label>
          <textarea rows={5} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          {error && <div className="text-red text-xs">{error}</div>}
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} disabled={!isDirty} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
