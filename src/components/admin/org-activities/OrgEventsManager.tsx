"use client";

import AdminTable from "../AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";
import OrgEventsCalendarGrid from "@/components/OrgEventsCalendarGrid";
import { useHomeTheme } from "@/hooks/useHomeTheme";
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
  const { t } = useHomeTheme();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: events, reload } = useRealtimeList<OrgEvent>("org_events", { orderBy: { column: "start_at" } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"month" | "list">("list");
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
      setError("소속 부서, 일정명, 시작·종료 시간을 확인해 주세요.");
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
    <div className={`grid grid-cols-1 gap-[18px] items-start ${editing ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">부서 활동 · 부서 일정 관리</h2>
          <div className="flex items-center gap-2">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                className={`px-3.5 py-1.5 text-sm font-semibold border-0 ${mode === "month" ? t.adminToggleActive : "bg-white"}`}
                onClick={() => setMode("month")}
              >
                월간
              </button>
              <button
                type="button"
                className={`px-3.5 py-1.5 text-sm font-semibold border-0 ${mode === "list" ? t.adminToggleActive : "bg-white"}`}
                onClick={() => setMode("list")}
              >
                목록
              </button>
            </div>
            <button onClick={startNew} className={t.adminBtnPrimary}>+ 일정 추가</button>
          </div>
        </div>
        {mode === "month" ? (
          <OrgEventsCalendarGrid events={events} categoryLabel={CATEGORY_LABEL} onEventClick={startEdit} />
        ) : (
          <AdminTable>
            <thead>
              <tr>
                <th className={t.adminTableHeaderCell}>일정명</th>
                <th className={`${t.adminTableHeaderCell} w-28`}>부서</th>
                <th className={`${t.adminTableHeaderCell} w-20`}>분류</th>
                <th className={`${t.adminTableHeaderCell} w-36`}>시작</th>
                <th className={`${t.adminTableHeaderCell} w-16`} />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} onClick={() => startEdit(e)} className={`cursor-pointer ${t.adminTableRowHover} ${editing === e.id ? t.adminTableRowActive : ""}`}>
                  <td className={t.adminTableCell}>{e.title}</td>
                  <td className={t.adminTableCell}>{orgName(e.org_id)}</td>
                  <td className={t.adminTableCell}><Badge color="navy">{CATEGORY_LABEL[e.category]}</Badge></td>
                  <td className={t.adminTableCell}>{fmtDateTime(e.start_at)}</td>
                  <td className={t.adminTableCell}>
                    <button className={t.adminBtnDanger} onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>삭제</button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 일정이 없습니다.</td></tr>}
            </tbody>
          </AdminTable>
        )}
      </div>
      {editing && (
        <div className={`${t.adminEditPanel} flex flex-col gap-1.5 sticky top-20`}>
          <h3>{editing === "new" ? "일정 추가" : "일정 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">소속 부서</label>
          <select className={t.adminInput} value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
            <option value="">부서를 선택하세요</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">일정명</label>
          <input className={t.adminInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">분류</label>
          <select className={t.adminInput} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as OrgEvent["category"] })}>
            {Object.entries(CATEGORY_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">시작 시간</label>
          <input type="datetime-local" className={t.adminInput} value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">종료 시간</label>
          <input type="datetime-local" className={t.adminInput} value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">장소</label>
          <input className={t.adminInput} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">설명</label>
          <textarea rows={3} className={t.adminInput} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {error && <div className="text-red text-xs">{error}</div>}
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} disabled={!isDirty} className={`${t.adminBtnPrimary} disabled:opacity-40 disabled:cursor-not-allowed`}>저장</button>
            <button onClick={() => setEditing(null)} className={t.adminBtnSecondary}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
