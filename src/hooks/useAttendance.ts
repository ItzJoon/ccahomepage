"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";

export function useAttendance(userId: string | null) {
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [checkedToday, setCheckedToday] = useState(false);
  const [freezeCredits, setFreezeCredits] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [freezeEligible, setFreezeEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const [{ data }, { data: prof }, { data: eligible }] = await Promise.all([
      supabase
        .from("user_attendance")
        .select("visit_date, streak_count")
        .eq("user_id", userId)
        .order("visit_date", { ascending: false })
        .limit(30),
      supabase.from("profiles").select("freeze_credits, max_streak").eq("id", userId).single(),
      // "마지막 방문일이 정확히 그저께인가"를 여기서 직접 계산하면 site_outages(장애
      // 기간 보호)를 몰라서, 장애 기간에 걸친 공백까지 "프리즈 필요"로 잘못 판단해
      // 불필요한 선택 모달을 띄우는 버그가 있었다(check_in_attendance가 실제로 계산하는
      // v_effective_gap과 기준이 달랐음). 같은 계산을 하는 is_freeze_eligible RPC
      // (supabase/schema.sql) 결과를 그대로 쓴다.
      supabase.rpc("is_freeze_eligible", { p_user_id: userId }),
    ]);
    if (data && data.length > 0) {
      setHistory(data.map((d) => d.visit_date));
      setStreak(data[0].streak_count);
      setCheckedToday(data[0].visit_date === todayKST());
    }
    setFreezeCredits(prof?.freeze_credits ?? 0);
    setMaxStreak(prof?.max_streak ?? 0);
    setFreezeEligible(!!eligible);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 오늘 체크인을 실제로 기록한다. useFreeze는 "프리즈가 필요한 상황일 때 학생이
   * 실제로 프리즈를 쓰기로 골랐는지"를 서버에 전달하는 값일 뿐이고, 서버
   * (check_in_attendance RPC, supabase/schema.sql 100번)가 지금 정말 프리즈를
   * 쓸 수 있는 상황인지 다시 계산해서 and로 묶으므로, 프리즈를 쓸 수 없는데
   * true를 보내도 무시된다. 오늘 이미 체크인했는지, streak를 얼마나 올릴지도
   * 전부 이 RPC가 단일 insert로 원자적으로 처리한다 — 예전엔 "프리즈 소비"와
   * "오늘 체크인"을 클라이언트에서 각각 별도 insert로 나눠서, 프리즈를 쓸 때마다
   * 한 번의 접속에서 streak가 실수로 2씩 올라가는 버그가 있었다. 여기서는
   * 클라이언트 쪽 화면 상태만 그 결과에 맞춰 갱신한다.
   */
  const checkIn = useCallback(
    async (useFreeze: boolean = false) => {
      if (!userId || checkedToday) return null;
      const { data, error } = await supabase.rpc("check_in_attendance", {
        p_user_id: userId,
        p_use_freeze: useFreeze,
      });
      if (error || !data) return null;
      const result = data as { streak: number | null; used_freeze: boolean; freeze_credits: number; max_streak: number };
      setCheckedToday(true);
      if (result.streak == null) return null; // 동시 요청 등으로 이미 다른 곳에서 처리됨
      setStreak(result.streak);
      setHistory((h) => [todayKST(), ...h]);
      // 프리즈 소비뿐 아니라 연속 7일마다 자동 재충전도 서버(check_in_attendance)가 함께
      // 처리하므로, 클라이언트에서 증감을 추측하지 않고 서버가 돌려준 최종값을 그대로 쓴다.
      setFreezeCredits(result.freeze_credits);
      setMaxStreak(result.max_streak);
      return result.streak;
    },
    [userId, checkedToday, supabase]
  );

  return { streak, history, checkedToday, checkIn, freezeCredits, maxStreak, freezeEligible, loading };
}
