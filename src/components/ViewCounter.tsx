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

// 비로그인 방문자를 하루 단위로 구분할 안정적인 값이 없어서, 브라우저에 한 번 생성해
// localStorage에 저장해두고 계속 재사용한다(로그인 사용자는 auth.uid()를 그대로 쓴다).
function getAnonViewerKey() {
  const key = "anon_viewer_key";
  let v = localStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(key, v);
  }
  return v;
}

/**
 * 공지/게시판 등 조회수 표시 + (배치 집계 방식) 증가 기록. posts/board_posts의
 * view_count 컬럼을 매번 직접 UPDATE하지 않고, content_view_events에 조회 이벤트만
 * 쌓아두면 pg_cron이 5분마다 집계해서 view_count에 반영한다(모든 콘텐츠 타입 공통 —
 * 이전에는 공지/게시판이 각자 RPC로 직접 UPDATE했었다). DB의 유니크 제약
 * (content_type, content_id, viewer_key, view_date)이 동일 사용자의 하루 중복 조회를
 * 막아주므로, 여기 쿠키는 그저 같은 페이지에서 이벤트를 여러 번 보내지 않기 위한
 * 클라이언트 쪽 최적화일 뿐이다.
 *
 * 화면에 보이는 숫자는 다음 집계 전까지는 낙관적으로 +1만 반영하고, DB의 실제
 * view_count는 최대 5분 뒤에 맞춰진다.
 */
export default function ViewCounter({
  postId,
  initialCount,
  contentType,
}: {
  postId: string;
  initialCount: number;
  contentType: "notice" | "board_post";
}) {
  const [count, setCount] = useState(initialCount);
  const cookieKey = `${contentType}_${postId}`;

  useEffect(() => {
    if (hasViewed(cookieKey)) return;
    markViewed(cookieKey);
    setCount((c) => c + 1);
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const viewerKey = data.user?.id ?? getAnonViewerKey();
        return createClient().from("content_view_events").insert({
          content_type: contentType,
          content_id: postId,
          viewer_key: viewerKey,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, contentType]);

  return <>조회 {count}</>;
}
