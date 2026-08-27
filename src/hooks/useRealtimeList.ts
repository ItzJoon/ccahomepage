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
    orderBy?: { column: string; ascending?: boolean };
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
    let query = supabase.from(table).select(options?.select ?? "*");
    if (options?.filter) query = options.filter(query);
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }
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
