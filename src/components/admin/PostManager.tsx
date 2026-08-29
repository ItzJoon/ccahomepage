"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import FileUpload, { AttachmentRef } from "./FileUpload";
import type { Post } from "@/lib/types";

interface PostWithAttachments extends Post {
  attachments: { id: string; file_url: string; file_name: string; file_path: string | null }[];
  author: { name: string | null; nickname: string | null; email: string } | null;
}

const emptyForm = {
  title: "",
  category: "일반",
  content: "",
  is_pinned: false,
  status: "published" as "published" | "scheduled" | "draft",
  publish_at: new Date().toISOString().slice(0, 10),
  video_source: null as "drive" | "upload" | null,
  video_url: "" as string | null,
  video_path: null as string | null,
};

// Supabase 무료 플랜은 전체 Storage 용량이 1GB라, 동영상 하나가 너무 크면 금방 찬다.
// 강제로 막지는 않고 안내만 하되, 너무 큰 파일은 업로드 자체를 막는다.
const MAX_VIDEO_MB = 50;

export default function PostManager({
  type,
  label,
  hasSchedulePin = true,
}: {
  type: "notice" | "news";
  label: string;
  hasSchedulePin?: boolean;
}) {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<PostWithAttachments>("posts", {
    select: "*, attachments(*), author:profiles(name, nickname, email)",
    filter: (q) => q.eq("type", type),
    orderBy: { column: "created_at", ascending: false },
  });

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [initialForm, setInitialForm] = useState({ ...emptyForm });
  const [newFiles, setNewFiles] = useState<AttachmentRef[]>([]);
  const [existingFiles, setExistingFiles] = useState<PostWithAttachments["attachments"]>([]);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) || newFiles.length > 0;
  const [saving, setSaving] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [iAmAdmin, setIAmAdmin] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setMyId(data.user?.id ?? null);
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmAdmin(!!me && ["admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  const startNew = () => {
    setForm({ ...emptyForm });
    setInitialForm({ ...emptyForm });
    setNewFiles([]);
    setExistingFiles([]);
    setEditing("new");
  };
  const startEdit = (item: PostWithAttachments) => {
    const next = {
      title: item.title,
      category: item.category,
      content: item.content,
      is_pinned: item.is_pinned,
      status: item.status,
      publish_at: item.publish_at,
      video_source: item.video_source,
      video_url: item.video_url,
      video_path: item.video_path,
    };
    setForm(next);
    setInitialForm(next);
    setNewFiles([]);
    setExistingFiles(item.attachments ?? []);
    setEditing(item.id);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    if (editing === "new") {
      const { data, error } = await supabase
        .from("posts")
        .insert({ ...form, type, author_id: myId })
        .select()
        .single();
      if (!error && data && newFiles.length > 0) {
        await supabase
          .from("attachments")
          .insert(newFiles.map((f) => ({ post_id: data.id, file_url: f.file_url, file_name: f.file_name, file_path: f.file_path, size: f.size })));
      }
    } else if (editing) {
      await supabase.from("posts").update(form).eq("id", editing);
      if (newFiles.length > 0) {
        await supabase
          .from("attachments")
          .insert(newFiles.map((f) => ({ post_id: editing, file_url: f.file_url, file_name: f.file_name, file_path: f.file_path, size: f.size })));
      }
    }
    setSaving(false);
    setEditing(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("posts").delete().eq("id", id);
    reload();
  };

  const uploadVideo = async (file: File) => {
    setVideoError(null);
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setVideoError(`동영상 파일은 ${MAX_VIDEO_MB}MB 이하만 업로드할 수 있습니다.`);
      return;
    }
    setVideoUploading(true);
    // 기존에 올려둔 동영상을 교체하는 경우, 이전 파일을 지워서 용량을 낭비하지 않는다.
    if (form.video_path) {
      await supabase.storage.from("news-videos").remove([form.video_path]);
    }
    const path = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("news-videos").upload(path, file);
    if (uploadError) {
      setVideoError(uploadError.message);
      setVideoUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("news-videos").getPublicUrl(path);
    setForm((f) => ({ ...f, video_source: "upload", video_url: pub.publicUrl, video_path: path }));
    setVideoUploading(false);
  };

  const removeVideo = async () => {
    if (form.video_path) {
      await supabase.storage.from("news-videos").remove([form.video_path]);
    }
    setForm((f) => ({ ...f, video_source: null, video_url: "", video_path: null }));
    setVideoError(null);
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
          <h2 className="text-[22px]">{label} 관리</h2>
          <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">
            + 새 글
          </button>
        </div>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">작성자</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">상태</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">발행일</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr
                key={n.id}
                onClick={() => startEdit(n)}
                className={`cursor-pointer hover:bg-[#F2F4F8] ${editing === n.id ? "bg-[#EAF0FB]" : ""}`}
              >
                <td className="p-2.5 border-b border-border text-sm">
                  {n.is_pinned && <span className="pin mr-1">고정</span>} {n.title}
                </td>
                <td className="p-2.5 border-b border-border text-sm text-muted">
                  {n.author?.nickname || n.author?.name || n.author?.email || "-"}
                </td>
                <td className="p-2.5 border-b border-border">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      n.status === "published"
                        ? "bg-[#E4F5EE] text-teal"
                        : n.status === "scheduled"
                        ? "bg-[#FFF3DC] text-gold"
                        : "bg-[#EEF1F6] text-muted"
                    }`}
                  >
                    {n.status === "published" ? "발행" : n.status === "scheduled" ? "예약" : "임시저장"}
                  </span>
                </td>
                <td className="p-2.5 border-b border-border text-sm">{n.publish_at}</td>
                <td className="p-2.5 border-b border-border">
                  {iAmAdmin ? (
                    <button
                      className="text-red text-xs font-bold"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(n.id);
                      }}
                    >
                      삭제
                    </button>
                  ) : (
                    <span className="text-muted text-xs" title="삭제는 admin 이상만 가능합니다. 임시저장으로 바꾸면 공개 화면에서 숨길 수 있습니다.">
                      🔒
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted text-center py-8 text-sm">
                  등록된 글이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
          <h3>{editing === "new" ? "새 글 작성" : "글 수정"}</h3>
          <label className="text-xs font-bold text-muted mt-2">제목</label>
          <input
            className="border border-border rounded-lg px-2.5 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="text-xs font-bold text-muted mt-2">카테고리</label>
          <input
            className="border border-border rounded-lg px-2.5 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <label className="text-xs font-bold text-muted mt-2">내용</label>
          <textarea
            rows={6}
            className="border border-border rounded-lg px-2.5 py-2 text-sm"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          {hasSchedulePin && (
            <>
              <label className="flex items-center gap-2 text-sm mt-2">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                />
                상단 고정
              </label>
              <label className="text-xs font-bold text-muted mt-2">발행 상태</label>
              <select
                className="border border-border rounded-lg px-2.5 py-2 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              >
                <option value="published">즉시 발행</option>
                <option value="scheduled">예약 발행</option>
                <option value="draft">임시저장</option>
              </select>
              <label className="text-xs font-bold text-muted mt-2">발행일</label>
              <input
                type="date"
                className="border border-border rounded-lg px-2.5 py-2 text-sm"
                value={form.publish_at}
                onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
              />
            </>
          )}
          <label className="text-xs font-bold text-muted mt-2">첨부파일</label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {existingFiles.map((f) => (
              <span key={f.id} className="bg-[#F2F4F8] rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5">
                📎 {f.file_name}
                <button type="button" onClick={() => removeExistingFile(f.id, f.file_path)} className="text-muted">
                  ✕
                </button>
              </span>
            ))}
          </div>
          <FileUpload files={newFiles} onChange={setNewFiles} />

          {type === "news" && (
            <>
              <label className="text-xs font-bold text-muted mt-2">회의록 동영상 (선택)</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, video_source: "drive", video_url: "" })}
                  className={`flex-1 text-xs font-bold rounded-lg px-2 py-1.5 border ${
                    form.video_source === "drive" ? "bg-navy text-white border-navy" : "border-border"
                  }`}
                >
                  구글 드라이브 링크
                </button>
                <label
                  className={`flex-1 text-center text-xs font-bold rounded-lg px-2 py-1.5 border cursor-pointer ${
                    form.video_source === "upload" ? "bg-navy text-white border-navy" : "border-border"
                  }`}
                >
                  {videoUploading ? "업로드 중…" : "파일 업로드"}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={videoUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadVideo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.video_source && (
                  <button type="button" onClick={removeVideo} className="text-xs text-red font-bold px-2">
                    제거
                  </button>
                )}
              </div>
              {form.video_source === "drive" && (
                <input
                  className="border border-border rounded-lg px-2.5 py-2 text-sm"
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                  value={form.video_url ?? ""}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                />
              )}
              {form.video_source === "upload" && form.video_url && (
                <p className="text-xs text-teal m-0">업로드됨: {form.video_path?.split("-").slice(1).join("-")}</p>
              )}
              <p className="text-[11px] text-muted m-0">
                드라이브 링크는 "링크가 있는 모든 사용자" 공유로 설정해야 재생됩니다. 직접 업로드는
                용량이 크면 저장 공간을 많이 차지하니 {MAX_VIDEO_MB}MB 이하 파일을 권장합니다.
              </p>
              {videoError && <p className="text-xs text-red m-0">{videoError}</p>}
            </>
          )}

          <div className="flex gap-2 mt-3.5">
            <button disabled={saving || !isDirty} onClick={save} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? "저장 중…" : "저장"}
            </button>
            <button onClick={() => setEditing(null)} className="border border-border text-sm rounded-lg px-4 py-2">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
