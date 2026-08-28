"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BadgeDef } from "@/lib/types";

/**
 * 뱃지 정의(badges) + 내가 획득한 뱃지(user_badges)를 관리하는 훅.
 * 체크인 후 checkMilestones(streak)를 호출하면 새로 조건을 만족한 뱃지를 자동 지급합니다.
 */
export function useBadges(userId: string | null) {
  const supabase = createClient();
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: badgeRows } = await supabase
      .from("badges")
      .select("*")
      .eq("is_active", true)
      .order("streak_threshold", { ascending: true });
    setBadges((badgeRows as BadgeDef[]) ?? []);

    if (userId) {
      const { data: earned } = await supabase.from("user_badges").select("badge_id").eq("user_id", userId);
      setEarnedIds(new Set((earned ?? []).map((e) => e.badge_id)));
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  /** 오늘 날짜가 뱃지의 날짜 조건(이전/이후/당일)을 만족하는지 확인합니다. */
  const matchesDateCondition = (b: BadgeDef, today: string) => {
    if (!b.date_condition || !b.date_condition_value) return false;
    if (b.date_condition === "before") return today < b.date_condition_value;
    if (b.date_condition === "after") return today > b.date_condition_value;
    return today === b.date_condition_value;
  };

  /**
   * 새로 달성한 스트릭 값 + 오늘 날짜를 기준으로, 아직 못 받은 자동 지급 뱃지(연속 접속/날짜 조건)가
   * 있으면 지급하고 반환합니다.
   */
  const checkMilestones = useCallback(
    async (streak: number) => {
      if (!userId) return [];
      const today = new Date().toISOString().slice(0, 10);
      const newlyEarned = badges.filter((b) => {
        if (earnedIds.has(b.id)) return false;
        if (b.award_type === "auto") return b.streak_threshold !== null && b.streak_threshold <= streak;
        if (b.award_type === "date") return matchesDateCondition(b, today);
        return false;
      });
      if (newlyEarned.length === 0) return [];
      const { error } = await supabase
        .from("user_badges")
        .insert(newlyEarned.map((b) => ({ user_id: userId, badge_id: b.id })));
      if (!error) {
        setEarnedIds((prev) => new Set([...prev, ...newlyEarned.map((b) => b.id)]));
      }
      return newlyEarned;
    },
    [userId, badges, earnedIds, supabase]
  );

  return { badges, earnedIds, loading, checkMilestones, reload: load };
}
