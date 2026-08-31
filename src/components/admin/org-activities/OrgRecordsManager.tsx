"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "../AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
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
  const { t } = useHomeTheme();
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: records, reload } = useRealtimeList<OrgRecord>("org_records", { orderBy: { column: "created_at", ascending: false } });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const [error, setError] = useState<string | null>(null);
  const { myId, isAdmin: iAmAdmin, isEditorUp: iAmEditorUp, role } = useMyRole();
  // designer도 admin과 동일하게 활동기록 삭제/숨김을 쓸 수 있다(RLS의
  // org_records_delete_own_or_admin이 is_designer()를 허용) — isAdmin/isEditorUp 원본은
  // 다른 화면에서도 재사용되므로 그대로 두고 이 화면 전용 플래그만 따로 둔다.
  const canModerateRecord = iAmAdmin || role === "designer";
  const canHideRecord = iAmEditorUp || role === "designer";
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
      setError("소속 부서, 제목, 내용을 모두 입력해 주세요.");
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

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("org_records").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${editing ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">부서 활동 · 활동기록 관리</h2>
          <button onClick={startNew} className={t.adminBtnPrimary}>+ 기록 작성</button>
        </div>
        <AdminTable>
          <thead>
            <tr>
              <th className={t.adminTableHeaderCell}>제목</th>
              <th className={`${t.adminTableHeaderCell} w-28`}>부서</th>
              <th className={`${t.adminTableHeaderCell} w-20`}>분류</th>
              <th className={`${t.adminTableHeaderCell} w-28`}>작성일</th>
              <th className={`${t.adminTableHeaderCell} w-32`} />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} onClick={() => startEdit(r)} className={`cursor-pointer ${t.adminTableRowHover} ${editing === r.id ? t.adminTableRowActive : ""}`}>
                <td className={t.adminTableCell}>
                  <div className="flex items-center gap-1">
                    <span {...truncateCellProps(r.title)}>{r.title}</span>
                    {r.is_hidden && (
                      <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] text-muted">숨김</span>
                    )}
                  </div>
                </td>
                <td className={t.adminTableCell}>{orgName(r.org_id)}</td>
                <td className={t.adminTableCell}><Badge color={CATEGORY_COLOR[r.category]}>{CATEGORY_LABEL[r.category]}</Badge></td>
                <td className={t.adminTableCell}>{fmt(r.created_at)}</td>
                <td className={t.adminTableCell}>
                  <div className={actionCellClass}>
                    {canHideRecord && (
                      <button
                        className="text-blue text-xs font-bold shrink-0"
                        onClick={(e) => { e.stopPropagation(); toggleHidden(r.id, r.is_hidden); }}
                      >
                        {r.is_hidden ? "숨김 해제" : "숨김"}
                      </button>
                    )}
                    {(myId === r.author_id || canModerateRecord) && (
                      <button
                        className={`${t.adminBtnDanger} shrink-0`}
                        onClick={(e) => { e.stopPropagation(); remove(r.id); }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">등록된 기록이 없습니다.</td></tr>}
          </tbody>
        </AdminTable>
      </div>
      {editing && (
        <div className={`${t.adminEditPanel} flex flex-col gap-1.5 sticky top-20`}>
          <h3>{editing === "new" ? "기록 작성" : "기록 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">소속 부서</label>
          <select className={t.adminInput} value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
            <option value="">부서를 선택하세요</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">분류</label>
          <select className={t.adminInput} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as OrgRecord["category"] })}>
            {Object.entries(CATEGORY_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <label className="text-xs font-bold text-muted mt-2">제목</label>
          <input className={t.adminInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">내용</label>
          <textarea rows={5} className={t.adminInput} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
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
