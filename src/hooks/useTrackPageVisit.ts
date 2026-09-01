"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "탐험가" 뱃지(사이트 7개 주요 메뉴를 한 번씩 다 방문)를 위한 방문 기록. 로그인한
 * 사용자가 이 페이지를 처음 열 때마다 서버에 mark_page_visited()를 호출한다 —
 * 실제로 7개를 다 채웠는지, 이미 방문한 적 있는지 등의 판단은 전부 그 함수(및
 * user_page_visits의 (user_id, page_key) 기본키)가 처리하므로, 여기서는 그냥
 * 마운트마다(중복 호출 방지를 위해 컴포넌트 인스턴스당 1회만) 호출만 하면 된다.
 *
 * 원래는 호출 전에 supabase.auth.getUser()로 로그인 여부를 먼저 확인했는데, getUser()는
 * 매번 서버에 토큰을 재검증하는 네트워크 요청이라 페이지 진입 직후(특히 로그인 직후
 * 리다이렉트된 첫 페이지) 이 요청이 늦게 끝나거나 일시적으로 실패하면 방문 기록 자체가
 * 조용히 누락됐다 — "분명 다 방문했는데 탐험가 뱃지가 안 뜬다"는 문제의 원인이었다.
 * mark_page_visited() 자체가 이미 auth.uid()가 없으면 조용히 종료하므로, 클라이언트에서
 * 로그인 여부를 미리 확인할 필요가 없다 — 비로그인 상태로 호출되면(RPC가 authenticated
 * role에만 권한이 있어) 403으로 실패하는데 그냥 무시하면 된다.
 */
export function useTrackPageVisit(pageKey: string) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const supabase = createClient();
    supabase.rpc("mark_page_visited", { p_page_key: pageKey }).then(() => {});
  }, [pageKey]);
}
