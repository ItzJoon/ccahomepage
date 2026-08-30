"use client";

import AdminTable, { truncateCellProps } from "@/components/admin/AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import FileUpload, { AttachmentRef } from "@/components/admin/FileUpload";
import type { RuleDoc } from "@/lib/types";

interface RuleWithAttachments extends RuleDoc {
  attachments: { id: string; file_url: string; file_name: string; file_path: string | null }[];
}

const empty = { title: "", category: "공통", content: "" };

export default function AdminRulesPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<RuleWithAttachments>("rules", {
    select: "*, attachments(*)",
    orderBy: { column: "title" },
  });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [initialForm, setInitialForm] = useState({ ...empty });
  const [newFiles, setNewFiles] = useState<AttachmentRef[]>([]);
  const [existingFiles, setExistingFiles] = useState<RuleWithAttachments["attachments"]>([]);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) || newFiles.length > 0;

  const startNew = () => { setForm({ ...empty }); setInitialForm({ ...empty }); setNewFiles([]); setExistingFiles([]); setEditing("new"); };
  const startEdit = (r: RuleWithAttachments) => {
    const next = { title: r.title, category: r.category, content: r.content };
    setForm(next);
    setInitialForm(next);
    setNewFiles([]);
    setExistingFiles(r.attachments ?? []);
    setEditing(r.id);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    if (editing === "new") {
      const { data, error } = await supabase.from("rules").insert(form).select().single();
      if (!error && data && newFiles.length > 0) {
        await supabase.from("attachments").insert(newFiles.map((f) => ({ rule_id: data.id, file_url: f.file_url, file_name: f.file_name, file_path: f.file_path, size: f.size })));
      }
    } else if (editing) {
      await supabase.from("rules").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editing);
      if (newFiles.length > 0) {
        await supabase.from("attachments").insert(newFiles.map((f) => ({ rule_id: editing, file_url: f.file_url, file_name: f.file_name, file_path: f.file_path, size: f.size })));
      }
    }
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("rules").delete().eq("id", id);
    reload();
  };

  const removeExistingFile = async (attId: string, path: string | null) => {
    if (path) await supabase.storage.from("attachments").remove([path]);
    await supabase.from("attachments").delete().eq("id", attId);
    setExistingFiles((f) => f.filter((x) => x.id !== attId));
  };

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${editing ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">규정 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 규정 추가</button>
        </div>
        <AdminTable>
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">분류</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => startEdit(r)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === r.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-sm">
                  <span {...truncateCellProps(r.title)}>{r.title}</span>
                </td>
                <td className="p-2.5 border-b border-border text-sm">{r.category}</td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>삭제</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">등록된 규정이 없습니다.</td></tr>}
          </tbody>
        </AdminTable>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "규정 추가" : "규정 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">제목</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">분류</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">본문</label>
          <textarea rows={10} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">첨부파일</label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {existingFiles.map((f) => (
              <span key={f.id} className="bg-[#F2F4F8] rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5">
                📎 {f.file_name}
                <button type="button" onClick={() => removeExistingFile(f.id, f.file_path)} className="text-muted">✕</button>
              </span>
            ))}
          </div>
          <FileUpload files={newFiles} onChange={setNewFiles} />
          <div className="flex gap-2 mt-3.5">
            <button onClick={save} disabled={!isDirty} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
