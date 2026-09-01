"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 게시판 글/댓글 좋아요 버튼. likes 테이블(user_id, target_type, target_id)에 본인
 * 행이 있는지로 좋아요 여부를 판단하고, 누르면 insert/delete로 토글한다. 개수 자체는
 * board_posts/board_comments.like_count(DB 트리거로 자동 갱신, 이미 실시간 구독 중이라
 * 화면에 자동 반영됨)를 그대로 받아서 보여주고, 내가 누른 직후에는 서버 반영을 기다리지
 * 않고 낙관적으로 먼저 반영한다.
 */
export default function LikeButton({
  targetType,
  targetId,
  likeCount,
  userId,
}: {
  targetType: "board_post" | "board_comment";
  targetId: string;
  likeCount: number;
  userId: string | null;
}) {
  const supabase = createClient();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(likeCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCount(likeCount);
  }, [likeCount]);

  useEffect(() => {
    if (!userId) {
      setLiked(false);
      return;
    }
    let active = true;
    supabase
      .from("likes")
      .select("id")
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setLiked(!!data);
      });
    return () => {
      active = false;
    };
  }, [userId, targetType, targetId, supabase]);

  const toggle = async () => {
    if (!userId || busy) return;
    setBusy(true);
    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      await supabase.from("likes").delete().eq("user_id", userId).eq("target_type", targetType).eq("target_id", targetId);
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      const { error } = await supabase.from("likes").insert({ user_id: userId, target_type: targetType, target_id: targetId });
      if (error) {
        // 이미 눌러둔 상태에서 다른 탭으로 또 누르는 등 드문 경우에만 실패 — 되돌린다.
        setLiked(false);
        setCount((c) => Math.max(0, c - 1));
      }
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!userId || busy}
      className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 disabled:opacity-50 ${liked ? "text-red" : "text-muted"}`}
    >
      {liked ? "❤️" : "🤍"} {count}
    </button>
  );
}
