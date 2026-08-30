"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import { RECORD_CATEGORY_COLOR, RECORD_CATEGORY_LABEL, fmt } from "./helpers";
import type { Organization, OrgRecord } from "@/lib/types";

export default function RecordsTab({ orgs, orgFilter, q }: { orgs: Organization[]; orgFilter: string; q: string }) {
  const supabase = createClient();
  const { myId: userId, isEditorUp: iAmEditor } = useMyRole();
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ org_id: "", category: "notice" as OrgRecord["category"], title: "", content: "" });
  const [error, setError] = useState<string | null>(null);

  const { rows: records } = useRealtimeList<OrgRecord>("org_records", { orderBy: { column: "created_at", ascending: false } });

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";
  const list = records
    .filter((r) => orgFilter === "all" || r.org_id === orgFilter)
    .filter((r) => !q.trim() || r.title.includes(q) || r.content.includes(q));

  const submit = async () => {
    setError(null);
    if (!form.org_id || !form.title.trim() || !form.content.trim()) {
      setError("소속 부서, 제목, 내용을 모두 입력해 주세요.");
      return;
    }
    const { error } = await supabase.from("org_records").insert({
      org_id: form.org_id,
      category: form.category,
      title: form.title,
      content: form.content,
      author_id: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ org_id: "", category: "notice", title: "", content: "" });
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
            {writing ? "닫기" : "+ 기록 작성"}
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
          <label className="text-sm font-bold mt-2">분류</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as OrgRecord["category"] })}
          >
            {Object.entries(RECORD_CATEGORY_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <label className="text-sm font-bold mt-2">제목</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">내용</label>
          <textarea
            rows={5}
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            기록 등록
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((r) => (
          <div key={r.id} className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge color={RECORD_CATEGORY_COLOR[r.category]}>{RECORD_CATEGORY_LABEL[r.category]}</Badge>
              <h3 className="text-base m-0">{r.title}</h3>
            </div>
            <div className="text-muted text-xs mb-2">{orgName(r.org_id)} · {fmt(r.created_at)}</div>
            <p className="text-sm whitespace-pre-wrap"><Linkify text={r.content} /></p>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-muted text-center py-8 text-sm">
            {q.trim() ? "검색 결과가 없습니다." : "등록된 기록이 없습니다."}
          </div>
        )}
      </div>
    </div>
  );
}
