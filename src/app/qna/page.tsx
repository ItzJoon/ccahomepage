"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";

interface QuestionWithAnswer {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  is_private: boolean;
  status: "pending" | "answered";
  created_at: string;
  answers: { id: string; content: string; created_at: string }[];
}

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function QnaPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<"list" | "write">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", isPrivate: false });
  const [error, setError] = useState<string | null>(null);

  const { rows, reload } = useRealtimeList<QuestionWithAnswer>("questions", {
    select: "*, answers(*)",
    orderBy: { column: "created_at", ascending: false },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const submit = async () => {
    setError(null);
    if (!userId) {
      setError("로그인 후 질문을 등록할 수 있습니다.");
      return;
    }
    if (!form.title.trim() || !form.content.trim()) return;
    const { error } = await supabase.from("questions").insert({
      user_id: userId,
      title: form.title,
      content: form.content,
      is_private: form.isPrivate,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ title: "", content: "", isPrivate: false });
    setTab("list");
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
          <label className="flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
            />
            비공개 질문으로 등록 (작성자와 관리자만 열람 가능)
          </label>
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            질문 등록
          </button>
        </div>
      ) : (
        <ul className="list-none m-0 p-0">
          {rows.map((q) => (
            <li key={q.id} className="border-b border-border py-2.5 cursor-pointer" onClick={() => setOpenId(openId === q.id ? null : q.id)}>
              <div className="flex items-center gap-2">
                {q.is_private ? <Badge color="red">비공개</Badge> : <Badge color="teal">공개</Badge>}
                <span className="flex-1 text-sm">{q.title}</span>
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
                  <p>{q.content}</p>
                  {q.answers && q.answers.length > 0 ? (
                    <div className="mt-2.5 bg-bg rounded-lg p-2.5">
                      <strong>학생자치회 답변</strong>
                      <p className="m-0">{q.answers[0].content}</p>
                    </div>
                  ) : (
                    <p className="text-muted">아직 답변이 등록되지 않았습니다.</p>
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
