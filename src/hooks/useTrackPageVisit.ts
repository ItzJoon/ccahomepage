"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "탐험가" 뱃지(사이트 7개 주요 메뉴를 한 번씩 다 방문)를 위한 방문 기록. 로그인한
 * 사용자가 이 페이지를 처음 열 때마다 서버에 mark_page_visited()를 호출한다 —
 * 실제로 7개를 다 채웠는지, 이미 방문한 적 있는지 등의 판단은 전부 그 함수(및
 * user_page_visits의 (user_id, page_key) 기본키)가 처리하므로, 여기서는 그냥
 * 마운트마다(중복 호출 방지를 위해 컴포넌트 인스턴스당 1회만) 호출만 하면 된다.
 */
export function useTrackPageVisit(pageKey: string) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.rpc("mark_page_visited", { p_page_key: pageKey });
    });
  }, [pageKey]);
}
