"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "@/components/admin/AdminTable";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";

interface QuestionWithAnswer {
  id: string;
  title: string;
  content: string;
  is_private: boolean;
  author_display_name: string | null;
  status: "pending" | "answered";
  is_hidden: boolean;
  created_at: string;
  answers: { id: string; content: string }[];
  asker: { name: string | null; nickname: string | null; email: string } | null;
}

export default function AdminQnaPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<QuestionWithAnswer>("questions", {
    select: "*, answers(*), asker:profiles(name, nickname, email)",
    orderBy: { column: "created_at", ascending: false },
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [iAmAdmin, setIAmAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmAdmin(!!me && ["admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  const openQ = (q: QuestionWithAnswer) => {
    setOpenId(q.id);
    setAnswerText(q.answers?.[0]?.content || "");
  };

  const removeQuestion = async (id: string) => {
    if (!confirm("이 질문을 삭제하시겠습니까? 등록된 답변도 함께 삭제됩니다.")) return;
    await supabase.from("questions").delete().eq("id", id);
    setOpenId(null);
    reload();
  };

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("questions").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  const submitAnswer = async (q: QuestionWithAnswer) => {
    if (!answerText.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (q.answers && q.answers.length > 0) {
      await supabase.from("answers").update({ content: answerText }).eq("id", q.answers[0].id);
    } else {
      await supabase.from("answers").insert({ question_id: q.id, content: answerText, answered_by: user?.id });
    }
    await supabase.from("questions").update({ status: "answered" }).eq("id", q.id);
    setOpenId(null);
    reload();
  };

  const current = rows.find((q) => q.id === openId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <h2 className="text-[22px] mb-4">Q&amp;A 관리</h2>
        <AdminTable>
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">제목</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32">질문자</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">공개</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">상태</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-32" />
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} onClick={() => openQ(q)} className={`cursor-pointer hover:bg-[#F2F4F8] ${openId === q.id ? "bg-[#EAF0FB]" : ""}`}>
                <td className="p-2.5 border-b border-border text-sm">
                  <span {...truncateCellProps(q.title)}>{q.title}</span>
                </td>
                <td className="p-2.5 border-b border-border text-sm">
                  {q.asker?.nickname || q.asker?.name || q.asker?.email || "-"}
                </td>
                <td className="p-2.5 border-b border-border">{q.is_private ? <Badge color="red">비공개</Badge> : <Badge color="teal">공개</Badge>}</td>
                <td className="p-2.5 border-b border-border">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${q.status === "answered" ? "bg-[#E4F5EE] text-teal" : "bg-[#FFF3DC] text-gold"}`}>
                    {q.status === "answered" ? "답변완료" : "대기"}
                  </span>
                  {q.is_hidden && (
                    <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] text-muted">숨김</span>
                  )}
                </td>
                <td className="p-2.5 border-b border-border">
                  <div className={actionCellClass}>
                    <button
                      className="text-blue text-xs font-bold shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHidden(q.id, q.is_hidden);
                      }}
                    >
                      {q.is_hidden ? "숨김 해제" : "숨김"}
                    </button>
                    {iAmAdmin ? (
                      <button
                        className="text-red text-xs font-bold shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeQuestion(q.id);
                        }}
                      >
                        삭제
                      </button>
                    ) : (
                      <span className="text-muted text-xs shrink-0" title="질문 삭제는 admin 이상만 가능합니다">🔒</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">질문이 없습니다.</td></tr>}
          </tbody>
        </AdminTable>
      </div>
      {current && (
        <div className="bg-white border border-border rounded-xl p-[18px] sticky top-20">
          <h3>{current.title}</h3>
          <p className="text-xs text-muted mb-1">
            질문자: {current.asker?.nickname || current.asker?.name || current.asker?.email || "알 수 없음"}
            {" · "}
            {current.author_display_name ? "학생 목록에 이름 공개" : "학생 목록에는 익명으로 표시"}
          </p>
          <p className="text-sm">{current.content}</p>
          <label className="text-xs font-bold text-muted mt-2 block">답변 작성</label>
          <textarea rows={5} className="border border-border rounded-lg px-2.5 py-2 text-sm w-full mt-1" value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
          <div className="flex gap-2 mt-3.5">
            <button onClick={() => submitAnswer(current)} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2">답변 등록</button>
            <button onClick={() => setOpenId(null)} className="border border-border text-sm rounded-lg px-4 py-2">닫기</button>
            {iAmAdmin && (
              <button onClick={() => removeQuestion(current.id)} className="text-red text-sm font-bold ml-auto">질문 삭제</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
