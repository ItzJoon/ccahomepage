"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function useAttendance(userId: string | null) {
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [checkedToday, setCheckedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_attendance")
      .select("visit_date, streak_count")
      .eq("user_id", userId)
      .order("visit_date", { ascending: false })
      .limit(30);
    if (data && data.length > 0) {
      setHistory(data.map((d) => d.visit_date));
      setStreak(data[0].streak_count);
      setCheckedToday(data[0].visit_date === todayStr());
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = useCallback(async () => {
    if (!userId || checkedToday) return;
    const today = todayStr();
    const yesterday = addDays(-1);
    const nextStreak = history[0] === yesterday ? streak + 1 : 1;
    const { error } = await supabase
      .from("user_attendance")
      .insert({ user_id: userId, visit_date: today, streak_count: nextStreak });
    if (!error) {
      setStreak(nextStreak);
      setCheckedToday(true);
      setHistory((h) => [today, ...h]);
    }
  }, [userId, checkedToday, history, streak, supabase]);

  return { streak, history, checkedToday, checkIn, loading };
}
