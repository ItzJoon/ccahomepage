"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import FileUpload, { AttachmentRef } from "./FileUpload";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";
import { safeStorageKey } from "@/lib/storageKey";
import type { Post, PostType } from "@/lib/types";

interface PostWithAttachments extends Post {
  attachments: { id: string; file_url: string; file_name: string; file_path: string | null }[];
  author: { name: string | null; nickname: string | null; email: string } | null;
}

interface TeacherInfo {
  subjects: string[];
  homeroom: number | null;
  homeroomLabel: string | null;
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
  type: "notice" as PostType,
  target_subject: null as string | null,
  target_homeroom: null as number | null,
};

function kindLabel(post: Pick<Post, "type" | "target_subject" | "target_homeroom">) {
  if (post.type === "subject_notice") return `교과·${post.target_subject}`;
  if (post.type === "homeroom_notice") return `학급·${post.target_homeroom}반`;
  return null;
}

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
  // 교과/학급 공지(teacher 전용)도 이 목록에 함께 나와야 관리할 수 있으므로, 공지사항
  // 화면(type==="notice")에서는 세 타입을 다 조회한다. 뉴스 화면은 기존과 동일.
  const { rows, reload } = useRealtimeList<PostWithAttachments>("posts", {
    select: "*, attachments(*), author:profiles(name, nickname, email)",
    filter: (q) => (type === "notice" ? q.in("type", ["notice", "subject_notice", "homeroom_notice"]) : q.eq("type", type)),
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
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  // 공지/뉴스 화면이 이 컴포넌트를 공유하므로(교사의 교과/학급 공지 포함), type별로
  // 임시저장 키를 분리한다. 기존 글 수정 중에는 자동저장하지 않는다(새 글 작성만 대상).
  const draftKey = `${type}_new`;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setMyId(data.user?.id ?? null);
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role, email").eq("id", data.user.id).single();
      setIAmAdmin(!!me && ["admin", "superadmin"].includes(me.role));
      const teacher = me?.role === "teacher";
      setIsTeacher(teacher);
      if (teacher && me?.email) {
        // teacher 본인의 담당 과목(콤마로 여러 개 저장될 수 있음)/담당 학급을 명단에서 가져와
        // 교과/학급 공지 작성 시 선택지로 쓴다. 본인이 실제로 담당하는 범위인지는 RLS(서버)
        // 에서도 다시 검증하므로, 여기서는 UI 편의를 위한 조회일 뿐이다.
        const { data: dm } = await supabase
          .from("directory_members")
          .select("subject, homeroom, homeroom_label")
          .eq("email", me.email)
          .maybeSingle();
        const subjects = ((dm?.subject as string | null) ?? "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        setTeacherInfo({ subjects, homeroom: dm?.homeroom ?? null, homeroomLabel: dm?.homeroom_label ?? null });
      }
    });
  }, [supabase]);

  const freshForm = () => {
    let initialType: PostType = type;
    let initialSubject: string | null = null;
    let initialHomeroom: number | null = null;
    if (type === "notice" && isTeacher) {
      if (teacherInfo?.subjects.length) {
        initialType = "subject_notice";
        initialSubject = teacherInfo.subjects[0];
      } else if (teacherInfo?.homeroom) {
        initialType = "homeroom_notice";
        initialHomeroom = teacherInfo.homeroom;
      }
    }
    return { ...emptyForm, type: initialType, target_subject: initialSubject, target_homeroom: initialHomeroom };
  };

  const startNew = () => {
    const next = freshForm();
    const draft = loadDraft<typeof emptyForm>(draftKey);
    if (draft && (draft.title || draft.content)) {
      setForm(draft);
      setHasDraft(true);
    } else {
      setForm(next);
      setHasDraft(false);
    }
    setInitialForm(next);
    setNewFiles([]);
    setExistingFiles([]);
    setEditing("new");
  };

  const discardDraft = () => {
    clearDraft(draftKey);
    setHasDraft(false);
    const next = freshForm();
    setForm(next);
    setInitialForm(next);
    setNewFiles([]);
    setExistingFiles([]);
  };

  // 새 글 작성 중일 때만(기존 글 수정 중에는 자동저장하지 않음) 살짝 디바운스해서 로컬에 저장.
  useEffect(() => {
    if (editing !== "new") return;
    const t = setTimeout(() => {
      if (form.title || form.content) saveDraft(draftKey, form);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editing]);
  const startEdit = (item: PostWithAttachments) => {
    // teacher는 본인이 쓴 교과/학급 공지만 수정할 수 있다(RLS도 동일 기준). 다른 선생님의
    // 공지는 목록에서 보이기만 하고 열어도 수정은 막는다 — 실수로 열었다가 저장해도
    // RLS가 막아서 조용히 실패하는 것보다 애초에 못 열게 하는 게 낫다.
    if (isTeacher && item.type !== "notice" && item.author_id !== myId) return;
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
      type: item.type,
      target_subject: item.target_subject,
      target_homeroom: item.target_homeroom,
    };
    setForm(next);
    setInitialForm(next);
    setNewFiles([]);
    setExistingFiles(item.attachments ?? []);
    setEditing(item.id);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    if (form.type === "subject_notice" && !form.target_subject) return;
    if (form.type === "homeroom_notice" && !form.target_homeroom) return;
    setSaving(true);
    if (editing === "new") {
      const { data, error } = await supabase
        .from("posts")
        .insert({ ...form, author_id: myId })
        .select()
        .single();
      if (!error && data && newFiles.length > 0) {
        await supabase
          .from("attachments")
          .insert(newFiles.map((f) => ({ post_id: data.id, file_url: f.file_url, file_name: f.file_name, file_path: f.file_path, size: f.size })));
      }
      if (!error) {
        clearDraft(draftKey);
        setHasDraft(false);
        // 새 글이 발행 상태로 등록되면 대상자에게 이메일 알림을 보낸다. 대상 전체에게
        // 순차 발송하느라 시간이 걸릴 수 있어 응답을 기다리지 않고 백그라운드로 흘려보낸다
        // (실패는 화면에 안 뜨고 email_notification_logs에만 남는다 — 관리자 활동 로그와
        // 별개로 발송 실패만 따로 확인할 수 있게 한 이유).
        if (data.status === "published") {
          fetch("/api/send-notice-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId: data.id }),
          }).catch(() => {});
        }
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

  // 삭제와 달리 학생 화면에서만 안 보이게 하고 관리자 화면에서는 계속 확인할 수 있다.
  // 삭제(admin 이상)와 달리 editor 이상이면 누구나 누를 수 있다.
  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("posts").update({ is_hidden: !isHidden }).eq("id", id);
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
    // 원본 파일명(한글/공백 등)을 그대로 키로 쓰면 "Invalid key" 오류가 나므로 안전한 키로 바꿔서 올린다.
    const path = safeStorageKey(file.name);
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
          {!(type === "notice" && isTeacher && !teacherInfo?.subjects.length && !teacherInfo?.homeroom) && (
            <button onClick={startNew} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">
              + 새 글
            </button>
          )}
        </div>
        {type === "notice" && isTeacher && !teacherInfo?.subjects.length && !teacherInfo?.homeroom && (
          <p className="text-red text-xs mb-3">
            명단에 담당 과목/학급 정보가 없어 공지를 등록할 수 없습니다. 관리자에게 문의해 주세요.
          </p>
        )}
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
            {rows.map((n) => {
              const readOnlyForMe = isTeacher && n.type !== "notice" && n.author_id !== myId;
              return (
              <tr
                key={n.id}
                onClick={() => startEdit(n)}
                className={`hover:bg-[#F2F4F8] ${editing === n.id ? "bg-[#EAF0FB]" : ""} ${readOnlyForMe ? "cursor-default" : "cursor-pointer"}`}
              >
                <td className="p-2.5 border-b border-border text-sm">
                  {kindLabel(n) && <span className="text-[11px] font-bold text-blue mr-1">[{kindLabel(n)}]</span>}
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
                  {n.is_hidden && (
                    <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] text-muted">숨김</span>
                  )}
                </td>
                <td className="p-2.5 border-b border-border text-sm">{n.publish_at}</td>
                <td className="p-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    {!readOnlyForMe && (
                      <button
                        className="text-blue text-xs font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHidden(n.id, n.is_hidden);
                        }}
                      >
                        {n.is_hidden ? "숨김 해제" : "숨김"}
                      </button>
                    )}
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
                      <span className="text-muted text-xs" title="삭제는 admin 이상만 가능합니다.">
                        🔒
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
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

          {hasDraft && editing === "new" && (
            <div className="flex items-center justify-between text-xs bg-[#EAF0FB] rounded-lg px-3 py-2">
              <span>임시저장된 내용을 불러왔습니다.</span>
              <button type="button" onClick={discardDraft} className="text-red font-bold">
                지우고 새로 쓰기
              </button>
            </div>
          )}

          {type === "notice" && isTeacher && (
            <>
              <label className="text-xs font-bold text-muted mt-2">공지 유형</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={!teacherInfo?.subjects.length}
                  onClick={() =>
                    setForm({ ...form, type: "subject_notice", target_subject: teacherInfo?.subjects[0] ?? null, target_homeroom: null })
                  }
                  className={`flex-1 text-xs font-bold rounded-lg px-2 py-1.5 border disabled:opacity-40 disabled:cursor-not-allowed ${
                    form.type === "subject_notice" ? "bg-navy text-white border-navy" : "border-border"
                  }`}
                >
                  교과 공지
                </button>
                <button
                  type="button"
                  disabled={!teacherInfo?.homeroom}
                  onClick={() =>
                    setForm({ ...form, type: "homeroom_notice", target_homeroom: teacherInfo?.homeroom ?? null, target_subject: null })
                  }
                  className={`flex-1 text-xs font-bold rounded-lg px-2 py-1.5 border disabled:opacity-40 disabled:cursor-not-allowed ${
                    form.type === "homeroom_notice" ? "bg-navy text-white border-navy" : "border-border"
                  }`}
                >
                  학급 공지
                </button>
              </div>
              {form.type === "subject_notice" && (
                <select
                  className="border border-border rounded-lg px-2.5 py-2 text-sm"
                  value={form.target_subject ?? ""}
                  onChange={(e) => setForm({ ...form, target_subject: e.target.value })}
                >
                  {(teacherInfo?.subjects ?? []).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              {form.type === "homeroom_notice" && (
                <p className="text-sm text-muted m-0">
                  담당 학급: {teacherInfo?.homeroomLabel || `${teacherInfo?.homeroom}반`}
                </p>
              )}
            </>
          )}

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
