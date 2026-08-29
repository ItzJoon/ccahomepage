"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { secondsUntilNextMidnightKST } from "@/lib/date";

function hasViewed(postId: string) {
  return document.cookie.split("; ").some((c) => c === `nv_${postId}=1`);
}
function markViewed(postId: string) {
  document.cookie = `nv_${postId}=1; max-age=${secondsUntilNextMidnightKST()}; path=/`;
}

/**
 * 공지 조회수 표시 + 증가. 서버 컴포넌트에서 매 렌더링마다(=새로고침마다) 그냥
 * update를 호출하면 카운트가 무한정 늘어나므로, 여기서 브라우저 쿠키로 "이미 세었는지"를
 * 기억해 같은 브라우저로 다시 봐도 한 번만 카운트되게 한다. 조회 시점부터 고정 24시간이
 * 아니라 한국 시간 기준 다음 자정에 리셋되도록 만료 시간을 계산한다.
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
