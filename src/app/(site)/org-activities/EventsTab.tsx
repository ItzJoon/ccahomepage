"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import Badge from "@/components/Badge";
import { EVENT_CATEGORY_LABEL, fmtDateTime } from "./helpers";
import type { Organization, OrgEvent } from "@/lib/types";

export default function EventsTab({ orgs, orgFilter }: { orgs: Organization[]; orgFilter: string }) {
  const supabase = createClient();
  const { myId: userId, isEditorUp: iAmEditor } = useMyRole();
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({
    org_id: "",
    title: "",
    description: "",
    location: "",
    category: "meeting" as OrgEvent["category"],
    start_at: "",
    end_at: "",
  });
  const [error, setError] = useState<string | null>(null);

  const { rows: events } = useRealtimeList<OrgEvent>("org_events", { orderBy: { column: "start_at" } });

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";
  const list = orgFilter === "all" ? events : events.filter((e) => e.org_id === orgFilter);

  const submit = async () => {
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
    const { error } = await supabase.from("org_events").insert({
      org_id: form.org_id,
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      category: form.category,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      created_by: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ org_id: "", title: "", description: "", location: "", category: "meeting", start_at: "", end_at: "" });
    setWriting(false);
  };

  return (
    <div>
      {iAmEditor && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setWriting((v) => !v)}
            className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5"
          >
            {writing ? "닫기" : "+ 일정 등록"}
          </button>
        </div>
      )}

      {writing && iAmEditor && (
        <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 mb-4">
          <label className="text-sm font-bold">소속 부서</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.org_id}
            onChange={(e) => setForm({ ...form, org_id: e.target.value })}
          >
            <option value="">부서를 선택하세요</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="text-sm font-bold mt-2">일정명</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">분류</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as OrgEvent["category"] })}
          >
            {Object.entries(EVENT_CATEGORY_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-bold">시작 시간</label>
              <input
                type="datetime-local"
                className="border border-border rounded-lg px-3 py-2 text-sm w-full"
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-bold">종료 시간</label>
              <input
                type="datetime-local"
                className="border border-border rounded-lg px-3 py-2 text-sm w-full"
                value={form.end_at}
                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
              />
            </div>
          </div>
          <label className="text-sm font-bold mt-2">장소</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">설명</label>
          <textarea
            rows={3}
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            일정 등록
          </button>
        </div>
      )}

      <ul className="list-none m-0 p-0">
        {list.map((e) => (
          <li key={e.id} className="border-b border-border py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color="navy">{EVENT_CATEGORY_LABEL[e.category]}</Badge>
              <span className="flex-1 text-sm font-bold">{e.title}</span>
              <span className="text-xs text-muted">{orgName(e.org_id)}</span>
            </div>
            <div className="text-xs text-muted mt-1">
              {fmtDateTime(e.start_at)} ~ {fmtDateTime(e.end_at)}
              {e.location ? ` · ${e.location}` : ""}
            </div>
            {e.description && <p className="text-sm mt-1">{e.description}</p>}
          </li>
        ))}
        {list.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 일정이 없습니다.</div>}
      </ul>
    </div>
  );
}
