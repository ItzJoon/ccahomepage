"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Linkify from "@/components/Linkify";
import type { BoardComment } from "@/lib/types";

interface Row extends BoardComment {
  author: { name: string | null; nickname: string | null; profile_image: string | null } | null;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// parent_id 기준으로 부모→자식 목록을 미리 묶어둬서, 렌더링할 때마다 매번 전체를
// 훑지 않고 바로 자식 배열을 꺼내 쓸 수 있게 한다(대댓글은 한 단계만 지원 — parent_id가
// 있는 댓글에 다시 답글을 달면 같은 parent_id의 형제로 붙는다, 무한 중첩 방지).
function groupByParent(rows: Row[]) {
  const map = new Map<string | null, Row[]>();
  for (const r of rows) {
    const key = r.parent_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

export default function BoardComments({ postId, userId }: { postId: string; userId: string | null }) {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<Row>("board_comments", {
    select: "*, author:profiles(name, nickname, profile_image)",
    filter: (q) => q.eq("post_id", postId),
    orderBy: { column: "created_at", ascending: true },
  });
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const byParent = groupByParent(rows);
  const roots = byParent.get(null) ?? [];

  const submitComment = async (parentId: string | null, text: string, onDone: () => void) => {
    if (!userId || !text.trim()) return;
    await supabase.from("board_comments").insert({ post_id: postId, parent_id: parentId, author_id: userId, content: text });
    onDone();
    reload();
  };

  const removeComment = async (id: string) => {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
    await supabase.from("board_comments").delete().eq("id", id);
    reload();
  };

  const renderNode = (node: Row, depth: number) => {
    // 대댓글에 또 답글을 달면 같은 parent_id(최상위 댓글)로 묶어서, 2단계까지만
    // 시각적으로 들여쓰기한다(무한 중첩 대신 카카오톡/네이버 카페식 평평한 대댓글).
    const children = depth === 0 ? byParent.get(node.id) ?? [] : [];
    const authorLabel = node.author?.nickname || node.author?.name || "탈퇴한 사용자";
    return (
      <div key={node.id} className={depth > 0 ? "ml-6 mt-2.5 border-l-2 border-border pl-3" : "mt-3.5 pt-3.5 border-t border-border first:border-t-0 first:pt-0"}>
        <div className="flex items-center gap-1.5 text-sm">
          {node.author?.profile_image ? (
            <img src={node.author.profile_image} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-[9px] font-bold shrink-0">
              {authorLabel[0]}
            </span>
          )}
          <strong>{authorLabel}</strong>
          <span className="text-muted text-xs">{fmtDateTime(node.created_at)}</span>
        </div>
        <p className="text-sm mt-1 mb-1">
          <Linkify text={node.content} />
        </p>
        <div className="flex gap-2.5 text-xs">
          {userId && depth === 0 && (
            <button onClick={() => setReplyTo(replyTo === node.id ? null : node.id)} className="text-blue font-bold">
              답글
            </button>
          )}
          {userId === node.author_id && (
            <button onClick={() => removeComment(node.id)} className="text-red font-bold">
              삭제
            </button>
          )}
        </div>
        {replyTo === node.id && (
          <div className="flex gap-2 mt-1.5">
            <input
              className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="답글을 입력하세요"
            />
            <button
              onClick={() => submitComment(node.id, replyContent, () => { setReplyContent(""); setReplyTo(null); })}
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
        <div className="flex gap-2 mb-1">
          <input
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글을 입력하세요"
          />
          <button onClick={() => submitComment(null, content, () => setContent(""))} className="bg-gold text-white font-bold text-sm rounded-lg px-4">
            등록
          </button>
        </div>
      ) : (
        <p className="text-muted text-sm mb-1">로그인 후 댓글을 작성할 수 있습니다.</p>
      )}
      {roots.map((r) => renderNode(r, 0))}
      {roots.length === 0 && <p className="text-muted text-sm mt-3">첫 댓글을 남겨보세요.</p>}
    </div>
  );
}
