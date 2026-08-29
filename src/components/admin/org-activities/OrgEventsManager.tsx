"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";
import type { Organization, OrgEvent } from "@/lib/types";

const CATEGORY_LABEL: Record<OrgEvent["category"], string> = {
  meeting: "회의",
  event: "행사",
  deadline: "마감",
  general: "일반",
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const empty = {
  org_id: "",
  title: "",
  description: "",
  location: "",
  category: "meeting" as OrgEvent["category"],
  start_at: "",
  end_at: "",
};

export default function OrgEventsManager() {
  const supabase = createClient();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: events, reload } = useRealtimeList<OrgEvent>("org_events", { orderBy: { column: "start_at" } });
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
  const startEdit = (e: OrgEvent) => {
    const next = {
      org_id: e.org_id,
      title: e.title,
      description: e.description || "",
      location: e.location || "",
      category: e.category,
      start_at: toDatetimeLocal(e.start_at),
      end_at: toDatetimeLocal(e.end_at),
    };
    setForm(next);
    setInitialForm(next);
    setError(null);
    setEditing(e.id);
  };

  const save = async () => {
    setError(null);
    if (!form.org_id || !form.title.trim() || !form.start_at || !form.end_at) {
      setError("소속 조직, 일정명, 시작·종료 시간을 확인해 주세요.");
      return;
    }
    const start = new Date(form.start_at);
    const end = new Date(form.end_at);
    if (end <= start) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    const payload = {
      org_id: form.org_id,
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      category: form.category,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    };
    if (editing === "new") {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("org_events").insert({ ...payload, created_by: user?.id });
    } else if (editing) {
      await supabase.from("org_events").update(payload).eq("id", editing);
    }
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    await supabase.from("org_events").delete().eq("id", id);
    if (editing === id) setEditing(null);
    reload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">조직 활동 · 조직 일정 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 일정 추가</button>
        </div>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">일정명</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">조직</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">분류</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-36">시작</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} onClick={() => startEdit(e)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === e.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-sm">{e.title}</td>
                <td className="p-2.5 border-b border-border text-sm">{orgName(e.org_id)}</td>
                <td className="p-2.5 border-b border-border"><Badge color="navy">{CATEGORY_LABEL[e.category]}</Badge></td>
                <td className="p-2.5 border-b border-border text-sm">{fmtDateTime(e.start_at)}</td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>삭제</button>
                </td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 일정이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "일정 추가" : "일정 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">소속 조직</label>
          <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
            <option value="">조직을 선택하세요</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">일정명</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">분류</label>
          <select className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as OrgEvent["category"] })}>
            {Object.entries(CATEGORY_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">시작 시간</label>
          <input type="datetime-local" className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">종료 시간</label>
          <input type="datetime-local" className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">장소</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">설명</label>
          <textarea rows={3} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
