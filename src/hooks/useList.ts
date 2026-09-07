"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * useRealtimeList와 API(옵션/반환값)는 동일하지만 realtime 구독 없이 마운트 시 한 번만
 * 조회한다. 관리자 혼자(또는 아주 가끔 둘이) 편집하는 CRUD 화면이나 드롭다운/피커용
 * 참조 데이터처럼, 다른 세션의 변경을 실시간으로 반영할 필요가 없는 곳에 쓴다 — 화면
 * 자신이 만든 변경은 각 페이지가 저장/삭제 직후 reload()를 직접 호출해서 반영한다
 * (기존 useRealtimeList를 쓰던 화면들도 이미 이 관례를 따르고 있었다).
 */
export function useList<T extends { id: string }>(
  table: string,
  options?: {
    select?: string;
    selectFrom?: string;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    filter?: (query: any) => any;
  }
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
    load();
  }, [load]);

  return { rows, loading, reload: load };
}
