"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const VIEWED_COOKIE_HOURS = 24;

function hasViewed(postId: string) {
  return document.cookie.split("; ").some((c) => c === `nv_${postId}=1`);
}
function markViewed(postId: string) {
  document.cookie = `nv_${postId}=1; max-age=${VIEWED_COOKIE_HOURS * 3600}; path=/`;
}

/**
 * 공지 조회수 표시 + 증가. 서버 컴포넌트에서 매 렌더링마다(=새로고침마다) 그냥
 * update를 호출하면 카운트가 무한정 늘어나므로, 여기서 브라우저 쿠키로 "이미 세었는지"를
 * 기억해 같은 브라우저로 일정 시간(24시간) 안에 다시 봐도 한 번만 카운트되게 한다.
 */
export default function ViewCounter({ postId, initialCount }: { postId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    if (hasViewed(postId)) return;
    markViewed(postId);
    setCount((c) => c + 1);
    createClient().rpc("increment_post_view_count", { target_id: postId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  return <>조회 {count}</>;
}
