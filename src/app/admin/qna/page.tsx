"use client";

import AdminTable, { truncateCellProps, actionCellClass } from "@/components/admin/AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useMyRole } from "@/hooks/useMyRole";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import Badge from "@/components/Badge";
import AuthorCell from "@/components/admin/AuthorCell";
import ImageUpload from "@/components/ImageUpload";
import ImageLightbox from "@/components/ImageLightbox";

interface QuestionWithAnswer {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_private: boolean;
  author_display_name: string | null;
  status: "pending" | "answered";
  is_hidden: boolean;
  created_at: string;
  answers: { id: string; content: string; image_url: string | null }[];
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
  const [answerImageUrl, setAnswerImageUrl] = useState<string | null>(null);
  const { isAdmin: iAmAdmin, role, myId } = useMyRole();
  // designer도 admin과 동일하게 질문 삭제를 쓸 수 있다(RLS의 questions_delete_admin이
  // is_designer()를 허용).
  const canDelete = iAmAdmin || role === "designer";
  const { t } = useHomeTheme();

  const openQ = (q: QuestionWithAnswer) => {
    setOpenId(q.id);
    setAnswerText(q.answers?.[0]?.content || "");
    setAnswerImageUrl(q.answers?.[0]?.image_url || null);
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
      await supabase.from("answers").update({ content: answerText, image_url: answerImageUrl }).eq("id", q.answers[0].id);
    } else {
      await supabase.from("answers").insert({ question_id: q.id, content: answerText, image_url: answerImageUrl, answered_by: user?.id });
    }
    await supabase.from("questions").update({ status: "answered" }).eq("id", q.id);
    setOpenId(null);
    setAnswerImageUrl(null);
    reload();
  };

  const current = rows.find((q) => q.id === openId);

  return (
    <div className={`grid grid-cols-1 gap-[18px] items-start ${current ? "lg:grid-cols-[1fr_360px]" : ""}`}>
      <div className="min-w-0">
        <h2 className="text-[22px] mb-4">Q&amp;A 관리</h2>
        <AdminTable>
          <thead>
            <tr>
              <th className={t.adminTableHeaderCell}>제목</th>
              <th className={`${t.adminTableHeaderCell} w-32`}>질문자</th>
              <th className={`${t.adminTableHeaderCell} w-20`}>공개</th>
              <th className={`${t.adminTableHeaderCell} w-32`}>상태</th>
              <th className={`${t.adminTableHeaderCell} w-32`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} onClick={() => openQ(q)} className={`cursor-pointer ${t.adminTableRowHover} ${openId === q.id ? t.adminTableRowActive : ""}`}>
                <td className={t.adminTableCell}>
                  <span {...truncateCellProps(q.title)}>{q.title}</span>
                </td>
                <td className={t.adminTableCell}>
                  <AuthorCell name={q.asker?.nickname || q.asker?.name || q.asker?.email || "-"} />
                </td>
                <td className={t.adminTableCell}>{q.is_private ? <Badge color="red">비공개</Badge> : <Badge color="teal">공개</Badge>}</td>
                <td className={t.adminTableCell}>
                  <div className={actionCellClass}>
                    <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${q.status === "answered" ? "bg-[#E4F5EE] text-teal" : "bg-[#FFF3DC] text-gold"}`}>
                      {q.status === "answered" ? "답변완료" : "대기"}
                    </span>
                    {q.is_hidden && (
                      <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] text-muted">숨김</span>
                    )}
                  </div>
                </td>
                <td className={t.adminTableCell}>
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
                    {canDelete ? (
                      <button
                        className={`${t.adminBtnDanger} shrink-0`}
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
        <div className={`${t.adminEditPanel} sticky top-20`}>
          <h3>{current.title}</h3>
          <p className="text-xs text-muted mb-1">
            질문자: {current.asker?.nickname || current.asker?.name || current.asker?.email || "알 수 없음"}
            {" · "}
            {current.author_display_name ? "학생 목록에 이름 공개" : "학생 목록에는 익명으로 표시"}
          </p>
          <p className="text-sm">{current.content}</p>
          {current.image_url && (
            <ImageLightbox src={current.image_url} alt="첨부 이미지" className="max-w-full max-h-56 rounded-lg border border-border mb-2 object-contain" />
          )}
          <label className="text-xs font-bold text-muted mt-2 block">답변 작성</label>
          <textarea rows={5} className={`${t.adminInput} w-full mt-1`} value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
          {myId && (
            <div className="mt-2">
              <ImageUpload userId={myId} value={answerImageUrl} onChange={setAnswerImageUrl} />
            </div>
          )}
          <div className="flex gap-2 mt-3.5">
            <button onClick={() => submitAnswer(current)} className={t.adminBtnPrimary}>답변 등록</button>
            <button onClick={() => setOpenId(null)} className={t.adminBtnSecondary}>닫기</button>
            {canDelete && (
              <button onClick={() => removeQuestion(current.id)} className="text-red text-sm font-bold ml-auto">질문 삭제</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
