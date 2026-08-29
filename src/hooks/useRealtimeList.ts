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

  const load = useCallback(async () => {
    let query = supabase.from(options?.selectFrom ?? table).select(options?.select ?? "*");
    if (options?.filter) query = options.filter(query);
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }
    if (options?.limit) query = query.limit(options.limit);
    const { data } = await query;
    setRows((data as unknown as T[]) ?? []);
    setLoading(false);
  }, [table]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    load();

    const channel = supabase
      .channel(channelNameRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (active) load();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [load, table]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, loading, reload: load };
}
