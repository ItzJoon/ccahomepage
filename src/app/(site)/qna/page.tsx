"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import ImageUpload from "@/components/ImageUpload";
import ImageLightbox from "@/components/ImageLightbox";
import ReportableName from "@/components/ReportableName";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";

const DRAFT_KEY = "qna_new";

interface QuestionWithAnswer {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  image_url: string | null;
  is_private: boolean;
  author_display_name: string | null;
  status: "pending" | "answered";
  created_at: string;
  answers: { id: string; content: string; image_url: string | null; created_at: string }[];
}


export default function QnaPage() {
  useTrackPageVisit("qna"); // "탐험가" 뱃지용 방문 기록
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [iAmAdmin, setIAmAdmin] = useState(false);
  const [tab, setTab] = useState<"list" | "write">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; content: string; image_url: string | null; isPrivate: boolean }>({
    title: "",
    content: "",
    image_url: null,
    isPrivate: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const { rows, reload } = useRealtimeList<QuestionWithAnswer>("questions", {
    select: "*, answers(*)",
    orderBy: { column: "created_at", ascending: false },
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUserId(data.user?.id ?? null);
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmAdmin(!!me && ["admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  // 질문하기 탭을 열면 임시저장된 내용이 있는지 확인해 자동으로 불러온다.
  useEffect(() => {
    if (tab !== "write") return;
    const draft = loadDraft<typeof form>(DRAFT_KEY);
    if (draft && (draft.title || draft.content)) {
      setForm(draft);
      setHasDraft(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "write") return;
    const t = setTimeout(() => {
      if (form.title || form.content) saveDraft(DRAFT_KEY, form);
    }, 500);
    return () => clearTimeout(t);
  }, [form, tab]);

  const discardDraft = () => {
    clearDraft(DRAFT_KEY);
    setForm({ title: "", content: "", image_url: null, isPrivate: false });
    setHasDraft(false);
  };

  const submit = async () => {
    setError(null);
    if (!userId) {
      setError("로그인 후 질문을 등록할 수 있습니다.");
      return;
    }
    if (!form.title.trim() || !form.content.trim()) return;

    // 익명 옵션은 없앴으므로 항상 작성자의 표시 이름을 함께 보낸다. 비공개 질문은
    // DB 트리거(enforce_qna_author_visibility)가 author_display_name을 무조건
    // null로 되돌려 목록에는 계속 "익명"으로만 보이므로, 여기서 따로 분기할 필요가 없다.
    const { data: profile } = await supabase.from("profiles").select("nickname, name").eq("id", userId).single();
    const authorDisplayName = profile?.nickname || profile?.name || null;

    const { error } = await supabase.from("questions").insert({
      user_id: userId,
      title: form.title,
      content: form.content,
      image_url: form.image_url,
      is_private: form.isPrivate,
      author_display_name: authorDisplayName,
    });
    if (error) {
      setError(error.message);
      return;
    }
    clearDraft(DRAFT_KEY);
    setForm({ title: "", content: "", image_url: null, isPrivate: false });
    setHasDraft(false);
    setTab("list");
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("이 질문을 삭제하시겠습니까? 등록된 답변도 함께 삭제됩니다.")) return;
    await supabase.from("questions").delete().eq("id", id);
    reload();
  };

  return (
    <div>
      <SectionTitle
        eyebrow="Q&A"
        title="질문과 답변"
        action={
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "list" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setTab("list")}
            >
              목록
            </button>
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "write" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setTab("write")}
            >
              질문하기
            </button>
          </div>
        }
      />
      {tab === "write" ? (
        <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 max-w-xl">
          {userId === null && (
            <div className="text-sm bg-[#FFF7E6] rounded-lg p-3 mb-2">
              <Link href="/login" className="text-blue font-bold">로그인</Link> 후 질문을 등록할 수 있습니다.
            </div>
          )}
          {hasDraft && (
            <div className="flex items-center justify-between text-xs bg-[#EAF0FB] rounded-lg px-3 py-2">
              <span>임시저장된 내용을 불러왔습니다.</span>
              <button type="button" onClick={discardDraft} className="text-red font-bold">
                지우고 새로 쓰기
              </button>
            </div>
          )}
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
          {userId && (
            <ImageUpload
              userId={userId}
              value={form.image_url}
              onChange={(image_url) => setForm({ ...form, image_url })}
            />
          )}
          <label className="flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
            />
            비공개 질문으로 등록 (작성자와 관리자만 열람 가능)
          </label>
          {form.isPrivate && (
            <p className="text-muted text-xs">비공개 질문은 작성자 이름이 항상 관리자에게만 공개됩니다.</p>
          )}
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            질문 등록
          </button>
        </div>
      ) : (
        <ul className="list-none m-0 p-0">
          {/* 비공개 질문은 공개 목록에 섞이지 않게 하되, 본인이 쓴 비공개 질문은 답변
              여부를 확인할 수 있어야 하므로 본인 것만 예외로 계속 보여준다(다른 사람의
              비공개 질문은 RLS로 애초에 내려오지도 않지만, admin이 이 화면을 볼 때는
              전체가 내려오므로 여기서도 걸러 다른 학생 것이 섞여 보이지 않게 한다). */}
          {rows.filter((q) => !q.is_private || q.user_id === userId).map((q) => (
            <li key={q.id} className="border-b border-border py-2.5 cursor-pointer" onClick={() => setOpenId(openId === q.id ? null : q.id)}>
              <div className="flex items-center gap-2">
                {q.is_private ? <Badge color="red">비공개</Badge> : <Badge color="teal">공개</Badge>}
                <span className="flex-1 text-sm">{q.title}</span>
                {q.author_display_name && q.user_id ? (
                  <span className="text-xs text-muted" onClick={(e) => e.stopPropagation()}>
                    <ReportableName
                      targetUserId={q.user_id}
                      name={q.author_display_name}
                      myId={userId ?? null}
                      context={`Q&A 질문: ${q.title}`}
                      canEditProfile={iAmAdmin}
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted">익명</span>
                )}
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    q.status === "answered" ? "bg-[#E4F5EE] text-teal" : "bg-[#EEF1F6] text-muted"
                  }`}
                >
                  {q.status === "answered" ? "답변완료" : "답변대기"}
                </span>
              </div>
              {openId === q.id && (
                <div className="pt-2.5 text-sm">
                  {/* RLS가 이미 열람 가능한 질문만 내려주므로, 내려온 행은 그대로 표시합니다 */}
                  <p><Linkify text={q.content} /></p>
                  {q.image_url && (
                    <ImageLightbox
                      src={q.image_url}
                      alt="첨부 이미지"
                      className="max-w-full max-h-64 rounded-lg border border-border mb-2.5 object-contain"
                    />
                  )}
                  {q.answers && q.answers.length > 0 ? (
                    <div className="mt-2.5 bg-bg rounded-lg p-2.5">
                      <strong>학생자치회 답변</strong>
                      <p className="m-0"><Linkify text={q.answers[0].content} /></p>
                      {q.answers[0].image_url && (
                        <ImageLightbox
                          src={q.answers[0].image_url}
                          alt="첨부 이미지"
                          className="max-w-full max-h-64 rounded-lg border border-border mt-2 object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-muted">아직 답변이 등록되지 않았습니다.</p>
                  )}
                  {userId && q.user_id === userId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(q.id);
                      }}
                      className="text-red text-xs font-bold mt-2"
                    >
                      내 질문 삭제
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
          {rows.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 질문이 없습니다.</div>}
        </ul>
      )}
    </div>
  );
}
