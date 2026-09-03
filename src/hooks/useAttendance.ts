"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST, addDaysKST } from "@/lib/date";

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
   * "어제 접속을 안 해서 오늘 체크인하면 프리즈가 필요한 상황"인지 여부. 프리즈는
   * 놓친 날이 정확히 하루일 때만 이어붙일 수 있으므로(check_in_attendance RPC의
   * v_freeze_eligible과 동일한 조건), 마지막 방문일이 그저께(오늘-2일)일 때만 true다.
   * 이 값 자체는 화면에 "선택 UI를 보여줄지" 판단하는 용도일 뿐 아무것도 기록하지
   * 않는다 — 실제 커밋은 항상 checkIn()을 호출해야만 일어난다.
   */
  const freezeEligible = !checkedToday && history.length > 0 && history[0] === addDaysKST(todayKST(), -2);

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
      const result = data as { streak: number | null; used_freeze: boolean };
      setCheckedToday(true);
      if (result.streak == null) return null; // 동시 요청 등으로 이미 다른 곳에서 처리됨
      setStreak(result.streak);
      setHistory((h) => [todayKST(), ...h]);
      if (result.used_freeze) setFreezeCredits((c) => Math.max(c - 1, 0));
      return result.streak;
    },
    [userId, checkedToday, supabase]
  );

  return { streak, history, checkedToday, checkIn, freezeCredits, freezeEligible, loading };
}
