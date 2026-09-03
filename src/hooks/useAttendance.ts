"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";

export function useAttendance(userId: string | null) {
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [checkedToday, setCheckedToday] = useState(false);
  const [freezeCredits, setFreezeCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const [{ data }, { data: prof }] = await Promise.all([
      supabase
        .from("user_attendance")
        .select("visit_date, streak_count")
        .eq("user_id", userId)
        .order("visit_date", { ascending: false })
        .limit(30),
      supabase.from("profiles").select("freeze_credits").eq("id", userId).single(),
    ]);
    if (data && data.length > 0) {
      setHistory(data.map((d) => d.visit_date));
      setStreak(data[0].streak_count);
      setCheckedToday(data[0].visit_date === todayKST());
    }
    setFreezeCredits(prof?.freeze_credits ?? 0);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 체크인 성공 시 갱신된 연속 접속일수를 반환합니다(뱃지 마일스톤 판정용). 실제
   * 판단(오늘 이미 체크인했는지, 스트릭 프리즈를 쓸지, streak를 얼마나 올릴지)은
   * 전부 check_in_attendance RPC(supabase/schema.sql 99번)가 단일 트랜잭션으로
   * 처리한다 — 예전엔 여기서 "프리즈 소비"와 "오늘 체크인"을 각각 별도 insert로
   * 나눠서 처리해서, 프리즈를 쓸 때마다 한 번의 접속에서 streak가 실수로 2씩
   * 올라가는 버그가 있었다(프리즈는 스트릭이 리셋되지 않게만 해줘야지, 놓친 날까지
   * 추가로 카운트해주면 안 된다). 여기서는 클라이언트 쪽 화면 상태만 그 결과에
   * 맞춰 갱신한다.
   */
  const checkIn = useCallback(async () => {
    if (!userId || checkedToday) return null;
    const { data, error } = await supabase.rpc("check_in_attendance", { p_user_id: userId });
    if (error || !data) return null;
    const result = data as { streak: number | null; used_freeze: boolean };
    setCheckedToday(true);
    if (result.streak == null) return null; // 동시 요청 등으로 이미 다른 곳에서 처리됨
    setStreak(result.streak);
    setHistory((h) => [todayKST(), ...h]);
    if (result.used_freeze) setFreezeCredits((c) => Math.max(c - 1, 0));
    return result.streak;
  }, [userId, checkedToday, supabase]);

  return { streak, history, checkedToday, checkIn, freezeCredits, loading };
}
