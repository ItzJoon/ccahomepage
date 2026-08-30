"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { secondsUntilNextMidnightKST } from "@/lib/date";

function hasViewed(key: string) {
  return document.cookie.split("; ").some((c) => c === `nv_${key}=1`);
}
function markViewed(key: string) {
  document.cookie = `nv_${key}=1; max-age=${secondsUntilNextMidnightKST()}; path=/`;
}

/**
 * 공지/게시판 등 조회수 표시 + 증가. 서버 컴포넌트에서 매 렌더링마다(=새로고침마다) 그냥
 * update를 호출하면 카운트가 무한정 늘어나므로, 여기서 브라우저 쿠키로 "이미 세었는지"를
 * 기억해 같은 브라우저로 다시 봐도 한 번만 카운트되게 한다. 조회 시점부터 고정 24시간이
 * 아니라 한국 시간 기준 다음 자정에 리셋되도록 만료 시간을 계산한다.
 *
 * rpc는 콘텐츠 타입마다 다른 테이블을 증가시키는 DB 함수 이름이다(예: 공지사항은
 * increment_post_view_count, 게시판은 increment_board_view_count). 쿠키 키는 rpc별로
 * 접두어를 붙여서, 같은 id를 가진 다른 콘텐츠 타입과 겹치지 않게 한다.
 */
export default function ViewCounter({
  postId,
  initialCount,
  rpc = "increment_post_view_count",
}: {
  postId: string;
  initialCount: number;
  rpc?: string;
}) {
  const [count, setCount] = useState(initialCount);
  const cookieKey = `${rpc}_${postId}`;

  useEffect(() => {
    if (hasViewed(cookieKey)) return;
    markViewed(cookieKey);
    setCount((c) => c + 1);
    createClient().rpc(rpc, { target_id: postId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, rpc]);

  return <>조회 {count}</>;
}
