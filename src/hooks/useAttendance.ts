"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// new Date().toISOString()는 항상 UTC 기준 날짜라서, 한국 시간 자정~오전 9시 사이에는
// 실제로는 "오늘"인데도 어제 날짜로 계산되는 버그가 있었다(예: 한국시간 8/29 08:00 =
// UTC 8/28 23:00, slice(0,10)이 "8/28"을 반환). 이러면 어제 이미 저장된 행과 visit_date가
// 겹쳐 unique 제약에 걸려 insert가 조용히 실패하고, 그날은 연속 접속일수가 올라가지 않는다.
// 한국 시간대(Asia/Seoul) 기준 달력 날짜를 직접 계산해서 이 문제를 없앤다.
function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
function addDays(base: string, n: number) {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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
      setCheckedToday(data[0].visit_date === todayStr());
    }
    setFreezeCredits(prof?.freeze_credits ?? 0);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /** 체크인 성공 시 갱신된 연속 접속일수를 반환합니다 (뱃지 마일스톤 판정용). */
  const checkIn = useCallback(async () => {
    if (!userId || checkedToday) return null;
    const today = todayStr();
    const yesterday = addDays(today, -1);
    const dayBeforeYesterday = addDays(today, -2);

    // 어제 기록이 없어도, 그저께까지는 이어져 있고 스트릭 프리즈가 남아있으면
    // 어제 하루를 프리즈로 채워서 연속 기록을 유지합니다.
    const useFreeze = history[0] !== yesterday && history[0] === dayBeforeYesterday && freezeCredits > 0;
    const nextStreak = history[0] === yesterday ? streak + 1 : useFreeze ? streak + 2 : 1;

    if (useFreeze) {
      await supabase
        .from("user_attendance")
        .insert({ user_id: userId, visit_date: yesterday, streak_count: streak + 1, is_freeze: true });
      await supabase.from("profiles").update({ freeze_credits: freezeCredits - 1 }).eq("id", userId);
    }

    const { error } = await supabase
      .from("user_attendance")
      .insert({ user_id: userId, visit_date: today, streak_count: nextStreak });
    if (!error) {
      setStreak(nextStreak);
      setCheckedToday(true);
      setHistory((h) => [today, ...(useFreeze ? [yesterday] : []), ...h]);
      if (useFreeze) setFreezeCredits((c) => c - 1);
      return nextStreak;
    }
    return null;
  }, [userId, checkedToday, history, streak, freezeCredits, supabase]);

  return { streak, history, checkedToday, checkIn, freezeCredits, loading };
}
