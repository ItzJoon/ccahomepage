"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 특정 테이블을 초기 로드 + Realtime 구독으로 항상 최신 상태로 유지하는 훅.
 * 같은 테이블을 화면 안에서 여러 번 구독해도(예: 홈에서 posts를 공지용/뉴스용으로 2번)
 * 채널 이름이 서로 겹치지 않도록 훅 인스턴스마다 고유한 채널 이름을 사용합니다.
 */
export function useRealtimeList<T extends { id: string }>(
  table: string,
  options?: {
    select?: string;
    // 뷰(예: 이름/이메일을 조인한 user_attendance_with_name)를 조회하고 싶지만
    // Realtime 구독(postgres_changes)은 뷰가 아니라 원본 테이블에서만 동작하므로,
    // 조회 대상만 다르게 지정할 수 있게 한다. 생략하면 기존처럼 table을 그대로 조회한다.
    selectFrom?: string;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    filter?: (query: any) => any;
  }
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const channelNameRef = useRef(
    `${table}-${Math.random().toString(36).slice(2)}-${Date.now()}`
  );

  // orderBy/select 등은 호출하는 쪽에서 매 렌더마다 새 객체 리터럴로 넘기는 경우가
  // 많아서(예: board 페이지의 정렬 토글이 orderBy: sort==="latest" ? {...} : {...}로
  // 매번 새 객체를 만듦) options 객체 자체를 의존성으로 두면 값이 그대로여도 매번
  // load가 재생성돼 버린다. 그래서 실제로 쿼리에 영향을 주는 원시값만 뽑아서
  // 의존성으로 쓴다 — 문자열/숫자/불린은 값이 같으면 재생성되지 않고, 값이 바뀌면
  // (예: 정렬 기준 컬럼 변경) 정확히 그때만 load가 새로 만들어진다. 이전엔 options가
  // 아예 의존성에 없어서 orderBy를 바꿔도(정렬 토글 등) 항상 최초 마운트 시점 값으로
  // 고정돼 정렬이 안 바뀌는 버그가 있었다.
  const orderColumn = options?.orderBy?.column;
  const orderAscending = options?.orderBy?.ascending;
  const selectStr = options?.select;
  const selectFromStr = options?.selectFrom;
  const limitNum = options?.limit;
  const filterFn = options?.filter;

  const load = useCallback(async () => {
    let query = supabase.from(selectFromStr ?? table).select(selectStr ?? "*");
    if (filterFn) query = filterFn(query);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: orderAscending ?? true });
    }
    if (limitNum) query = query.limit(limitNum);
    const { data } = await query;
    setRows((data as unknown as T[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, selectStr, selectFromStr, orderColumn, orderAscending, limitNum]);

  useEffect(() => {
    let active = true;
    load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      // 컴포넌트가 마운트되는 시점엔 SSR 쿠키로 이미 로그인된 상태라도, 클라이언트
      // supabase-js 인스턴스의 realtime 소켓에는 그 인증이 아직 반영되지 않았을 수 있다
      // (@supabase/ssr가 onAuthStateChange를 통해 비동기로 반영함). 채널을 그보다 먼저
      // 구독하면 이 연결이 미인증으로 처리돼 RLS를 통과 못 하고, 이후 이 테이블의 변경을
      // 계속 못 받는다 — 새로고침(=완전히 새로 불러오는 load()) 전까지는 실시간 반영이
      // 전혀 안 되는 버그의 원인이었다(예: 관리자 테마를 바꿔도 이미 열려 있던 다른 화면에는
      // 반영이 안 되거나, 옛 값이 한동안 남아있다 사라지는 것처럼 보임). 구독 전에 세션
      // 토큰을 realtime에 명시적으로 반영해 이 경합을 없앤다.
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(channelNameRef.current)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          if (active) load();
        })
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load, table]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, loading, reload: load };
}
