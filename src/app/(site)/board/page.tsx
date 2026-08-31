"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import ReportableName from "@/components/ReportableName";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";
import type { BoardPost } from "@/lib/types";

const DRAFT_KEY = "board_new";

interface Row extends BoardPost {
  author_name: string | null;
  author_avatar: string | null;
}

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function BoardPage() {
  useTrackPageVisit("board"); // "탐험가" 뱃지용 방문 기록
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [writing, setWriting] = useState(false);
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [form, setForm] = useState({ title: "", content: "" });
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // profiles를 그대로 조인하면 다른 사람 이름/사진은 RLS에 막혀 비어오므로(본인 또는
  // editor 이상만 조회 가능), 안전하게 이름/사진만 반환하는 computed column을 대신 쓴다
  // (supabase/schema.sql 51번 참고).
  const { rows, reload } = useRealtimeList<Row>("board_posts", {
    select: "*, author_name, author_avatar",
    orderBy: sort === "latest" ? { column: "created_at", ascending: false } : { column: "view_count", ascending: false },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  // 글쓰기 창을 열면 저장된 임시저장이 있는지 확인해서 자동으로 불러온다.
  useEffect(() => {
    if (!writing) return;
    const draft = loadDraft<{ title: string; content: string }>(DRAFT_KEY);
    if (draft && (draft.title || draft.content)) {
      setForm(draft);
      setHasDraft(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing]);

  // 입력할 때마다(살짝 디바운스) 로컬에 임시저장 — 작성 중 페이지를 벗어났다가 다시
  // 들어와도 복원할 수 있게 한다. 등록이 끝나면 지운다.
  useEffect(() => {
    if (!writing) return;
    const t = setTimeout(() => {
      if (form.title || form.content) saveDraft(DRAFT_KEY, form);
    }, 500);
    return () => clearTimeout(t);
  }, [form, writing]);

  const discardDraft = () => {
    clearDraft(DRAFT_KEY);
    setForm({ title: "", content: "" });
    setHasDraft(false);
  };

  const submit = async () => {
    setError(null);
    if (!userId) {
      setError("로그인 후 글을 등록할 수 있습니다.");
      return;
    }
    if (!form.title.trim() || !form.content.trim()) return;
    const { error } = await supabase.from("board_posts").insert({
      author_id: userId,
      title: form.title,
      content: form.content,
    });
    if (error) {
      setError(error.message);
      return;
    }
    clearDraft(DRAFT_KEY);
    setForm({ title: "", content: "" });
    setHasDraft(false);
    setWriting(false);
    reload();
  };

  return (
    <div>
      <SectionTitle
        eyebrow="BOARD"
        title="게시판"
        action={
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${sort === "latest" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setSort("latest")}
            >
              최신순
            </button>
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${sort === "popular" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setSort("popular")}
            >
              인기순
            </button>
          </div>
        }
      />

      <div className="flex justify-end mb-3">
        <button onClick={() => setWriting((v) => !v)} className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5">
          {writing ? "닫기" : "+ 글쓰기"}
        </button>
      </div>

      {writing && (
        <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 mb-4">
          {userId === null && (
            <div className="text-sm bg-[#FFF7E6] rounded-lg p-3 mb-2">로그인 후 글을 등록할 수 있습니다.</div>
          )}
          {hasDraft && (
            <div className="flex items-center justify-between text-xs bg-[#EAF0FB] rounded-lg px-3 py-2 mb-1">
              <span>임시저장된 내용을 불러왔습니다.</span>
              <button type="button" onClick={discardDraft} className="text-red font-bold">
                지우고 새로 쓰기
              </button>
            </div>
          )}
          <label className="text-sm font-bold">제목</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">내용</label>
          <textarea
            rows={6}
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            등록
          </button>
        </div>
      )}

      <table className="w-full border-collapse bg-white">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32">작성자</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">날짜</th>
            <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16">조회</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-[#F2F4F8]">
              <td className="p-2.5 border-b border-border">
                <Link href={`/board/${p.id}`}>{p.title}</Link>
              </td>
              <td className="p-2.5 border-b border-border text-sm text-muted">
                <div className="flex items-center gap-1.5">
                  {p.author_avatar ? (
                    <img src={p.author_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-[9px] font-bold">
                      {(p.author_name || "?")[0]}
                    </span>
                  )}
                  {p.author_id ? (
                    <ReportableName
                      targetUserId={p.author_id}
                      name={p.author_name || "이름 없음"}
                      myId={userId ?? null}
                      context={`게시판 글: ${p.title}`}
                    />
                  ) : (
                    "탈퇴한 사용자"
                  )}
                </div>
              </td>
              <td className="p-2.5 border-b border-border text-sm">{fmt(p.created_at)}</td>
              <td className="p-2.5 border-b border-border text-sm">{p.view_count}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} className="text-muted text-center py-8 text-sm">등록된 글이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
