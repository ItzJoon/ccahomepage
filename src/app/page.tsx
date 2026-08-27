"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 특정 테이블을 초기 로드 + Realtime 구독으로 항상 최신 상태로 유지하는 훅.
 * 관리자 사이트에서 INSERT/UPDATE/DELETE 하면 이 훅을 쓰는 모든 학생 화면에 즉시 반영됩니다.
 */
export function useRealtimeList<T extends { id: string }>(
  table: string,
  options?: {
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
    filter?: (query: any) => any; // supabase query builder에 .eq() 등을 체이닝
  }
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
    load();

    // 동시 구독 시 채널명 충돌을 방지하기 위한 고유 ID 생성
    const uniqueChannelId = `realtime:${table}:${Math.random().toString(36).substring(2, 9)}`;

    const channel = supabase
      .channel(uniqueChannelId)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        // 변경이 생기면 간단히 다시 불러옵니다 (목록 규모가 작은 학생회 사이트에 적합한 전략)
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, table]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, loading, reload: load };
}
