"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import ReportableName from "@/components/ReportableName";
import type { BoardPost } from "@/lib/types";

interface Row extends BoardPost {
  author: { name: string | null; nickname: string | null; profile_image: string | null } | null;
}

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function BoardPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [writing, setWriting] = useState(false);
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [form, setForm] = useState({ title: "", content: "" });
  const [error, setError] = useState<string | null>(null);

  const { rows, reload } = useRealtimeList<Row>("board_posts", {
    select: "*, author:profiles(name, nickname, profile_image)",
    orderBy: sort === "latest" ? { column: "created_at", ascending: false } : { column: "view_count", ascending: false },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

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
    setForm({ title: "", content: "" });
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
                  {p.author?.profile_image ? (
                    <img src={p.author.profile_image} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-[9px] font-bold">
                      {(p.author?.nickname || p.author?.name || "?")[0]}
                    </span>
                  )}
                  {p.author_id ? (
                    <ReportableName
                      targetUserId={p.author_id}
                      name={p.author?.nickname || p.author?.name || "이름 없음"}
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
