"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Linkify from "@/components/Linkify";
import ReportableName from "@/components/ReportableName";
import ReportButton from "@/components/ReportButton";
import Badge from "@/components/Badge";
import type { NoticeComment } from "@/lib/types";

interface Row extends NoticeComment {
  author_name: string | null;
  /** 공지 작성자 본인이면 "작성자", 작성자가 임원회/사법위원회 소속이면 같은 소속
   * 구성원의 댓글도 그 단체명으로 강조(supabase/schema.sql highlight_label(notice_comments)
   * 참고), 해당 없으면 null. */
  highlight_label: string | null;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// board_comments와 동일한 방식(대댓글은 한 단계만, parent_id 기준 그룹핑) — BoardComments.tsx 참고.
function groupByParent(rows: Row[]) {
  const map = new Map<string | null, Row[]>();
  for (const r of rows) {
    const key = r.parent_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

/**
 * 공지사항 댓글 — 게시판 댓글(BoardComments)과 작성/삭제/신고/도배방지/닉네임 표시
 * 로직은 동일하되, 완전히 별개 테이블(notice_comments)을 쓴다(게시판과 화면·데이터가
 * 섞이지 않아야 한다는 요구사항). 이미지 첨부·좋아요는 범위 밖이라 뺐다. 새 댓글이
 * 등록되면 DB 트리거(notify_notice_comment)가 알림 센터 알림을 자동으로 만들어주고,
 * 여기서는 그와 별개로 이메일 알림 API를 한 번 호출한다(이메일 발송은 트리거로 할 수
 * 없어서 — supabase/schema.sql 141번 주석 참고).
 */
export default function NoticeComments({ postId, userId }: { postId: string; userId: string | null }) {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Row>("notice_comments", {
    select: "*, author_name, highlight_label",
    filter: (q) => q.eq("post_id", postId),
    orderBy: { column: "created_at", ascending: true },
  });
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [iAmEditorUp, setIAmEditorUp] = useState(false);
  const [iAmAdmin, setIAmAdmin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("role").eq("id", userId).single().then(({ data }) => {
      setIAmEditorUp(!!data && ["editor", "admin", "superadmin"].includes(data.role));
      setIAmAdmin(!!data && ["admin", "superadmin"].includes(data.role));
    });
  }, [supabase, userId]);

  const byParent = groupByParent(rows);
  const roots = byParent.get(null) ?? [];

  const submitComment = async (parentId: string | null, text: string, onDone: () => void) => {
    if (!userId || !text.trim()) return;
    setFormError(null);
    const { data, error } = await supabase
      .from("notice_comments")
      .insert({ post_id: postId, parent_id: parentId, author_id: userId, content: text })
      .select("id")
      .single();
    if (error || !data) {
      setFormError(error?.message || "댓글을 등록하지 못했습니다.");
      return;
    }
    // 알림 센터 알림은 DB 트리거가 이미 처리했다 — 이메일만 별도로 요청한다(실패해도
    // 댓글 자체는 이미 등록됐으니 막지 않는다, 관리자 알림 발송의 웹 푸시와 동일한 방침).
    fetch("/api/notify-comment-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: data.id }),
    }).catch(() => {});
    onDone();
    reload();
  };

  const removeComment = async (id: string) => {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
    await supabase.from("notice_comments").delete().eq("id", id);
    reload();
  };

  const toggleHidden = async (id: string, isHidden: boolean) => {
    await supabase.from("notice_comments").update({ is_hidden: !isHidden }).eq("id", id);
    reload();
  };

  const renderNode = (node: Row, depth: number) => {
    const children = depth === 0 ? byParent.get(node.id) ?? [] : [];
    const rootId = depth === 0 ? node.id : node.parent_id!;
    const authorLabel = node.author_name || "탈퇴한 사용자";
    return (
      <div key={node.id} className={depth > 0 ? "ml-6 mt-2.5 border-l-2 border-border pl-3" : "mt-3.5 pt-3.5 border-t border-border first:border-t-0 first:pt-0"}>
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-[9px] font-bold shrink-0">
            {authorLabel[0]}
          </span>
          {node.author_id ? (
            <ReportableName
              targetUserId={node.author_id}
              name={authorLabel}
              myId={userId}
              context="공지 댓글"
              className="font-bold"
              canEditProfile={iAmAdmin}
            />
          ) : (
            <strong className="truncate max-w-[120px]" title={authorLabel}>{authorLabel}</strong>
          )}
          {node.highlight_label && (
            <Badge color="gold" className="shrink-0">{node.highlight_label}</Badge>
          )}
          <span className="text-muted text-xs shrink-0">{fmtDateTime(node.created_at)}</span>
          {node.is_hidden && (
            <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF1F6] dark:bg-white/10 text-muted">숨김</span>
          )}
        </div>
        <p className="text-sm mt-1 mb-1 whitespace-pre-wrap">
          <Linkify text={node.content} />
        </p>
        <div className="flex items-center gap-2.5 text-xs whitespace-nowrap">
          {userId && (
            <button onClick={() => setReplyTo(replyTo === node.id ? null : node.id)} className="text-blue font-bold shrink-0">
              답글
            </button>
          )}
          {iAmEditorUp && (
            <button onClick={() => toggleHidden(node.id, node.is_hidden)} className="text-blue font-bold shrink-0">
              {node.is_hidden ? "숨김 해제" : "숨김"}
            </button>
          )}
          {(userId === node.author_id || iAmAdmin) && (
            <button onClick={() => removeComment(node.id)} className="text-red font-bold shrink-0">
              삭제
            </button>
          )}
          <ReportButton
            targetType="notice_comment"
            targetId={node.id}
            authorId={node.author_id}
            myId={userId}
            context="공지 댓글"
          />
        </div>
        {replyTo === node.id && userId && (
          <div className="flex gap-2 mt-1.5">
            <textarea
              rows={2}
              className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm resize-none"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="답글을 입력하세요"
            />
            <button
              onClick={() =>
                submitComment(rootId, replyContent, () => {
                  setReplyContent("");
                  setReplyTo(null);
                })
              }
              className="bg-navy text-white text-xs font-bold rounded-lg px-3"
            >
              등록
            </button>
          </div>
        )}
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="mt-6">
      <h3 className="text-base font-bold mb-2">댓글 {rows.length}</h3>
      {userId ? (
        <div className="flex flex-col gap-1.5 mb-1">
          <div className="flex gap-2">
            <textarea
              rows={2}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="댓글을 입력하세요"
            />
            <button
              onClick={() => submitComment(null, content, () => setContent(""))}
              className="bg-gold text-white font-bold text-sm rounded-lg px-4"
            >
              등록
            </button>
          </div>
          {formError && <p className="text-red text-xs m-0">{formError}</p>}
        </div>
      ) : (
        <p className="text-muted text-sm mb-1">로그인 후 댓글을 작성할 수 있습니다.</p>
      )}
      {roots.map((r) => renderNode(r, 0))}
      {roots.length === 0 && <p className="text-muted text-sm mt-3">첫 댓글을 남겨보세요.</p>}
    </div>
  );
}
