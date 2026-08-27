"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import FileUpload, { AttachmentRef } from "@/components/admin/FileUpload";
import type { EventItem } from "@/lib/types";

interface EventWithAttachments extends EventItem {
  attachments: { id: string; file_url: string; file_name: string; file_path: string | null }[];
}

const empty = { title: "", description: "", start_at: new Date().toISOString().slice(0, 10), end_at: "", location: "", category: "회의" };

export default function AdminEventsPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<EventWithAttachments>("events", {
    select: "*, attachments(*)",
    orderBy: { column: "start_at" },
  });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [newFiles, setNewFiles] = useState<AttachmentRef[]>([]);
  const [existingFiles, setExistingFiles] = useState<EventWithAttachments["attachments"]>([]);

  const startNew = () => { setForm({ ...empty }); setNewFiles([]); setExistingFiles([]); setEditing("new"); };
  const startEdit = (e: EventWithAttachments) => {
    setForm({ title: e.title, description: e.description || "", start_at: e.start_at, end_at: e.end_at || "", location: e.location || "", category: e.category });
    setNewFiles([]);
    setExistingFiles(e.attachments ?? []);
    setEditing(e.id);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = { ...form, end_at: form.end_at || null };
    if (editing === "new") {
      const { data, error } = await supabase.from("events").insert(payload).select().single();
      if (!error && data && newFiles.length > 0) {
        await supabase.from("attachments").insert(newFiles.map((f) => ({ event_id: data.id, file_url: f.file_url, file_name: f.file_name, file_path: f.file_path, size: f.size })));
      }
    } else if (editing) {
      await supabase.from("events").update(payload).eq("id", editing);
      if (newFiles.length > 0) {
        await supabase.from("attachments").insert(newFiles.map((f) => ({ event_id: editing, file_url: f.file_url, file_name: f.file_name, file_path: f.file_path, size: f.size })));
      }
    }
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("events").delete().eq("id", id);
    reload();
  };

  const removeExistingFile = async (attId: string, path: string | null) => {
    if (path) await supabase.storage.from("attachments").remove([path]);
    await supabase.from("attachments").delete().eq("id", attId);
    setExistingFiles((f) => f.filter((x) => x.id !== attId));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[22px]">일정 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">+ 새 일정</button>
        </div>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">날짜</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} onClick={() => startEdit(e)} className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === e.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-sm">{e.title}</td>
                <td className="p-2.5 border-b border-border text-sm">{e.start_at}</td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>삭제</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">등록된 일정이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "새 일정" : "일정 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">제목</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">카테고리</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">시작일</label>
          <input type="date" className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">종료일 (선택)</label>
          <input type="date" className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">장소</label>
          <input className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <label className="text-xs font-bold text-muted mt-2">설명</label>
          <textarea rows={4} className="border border-border rounded-lg px-2.5 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
            <button onClick={save} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2">저장</button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
