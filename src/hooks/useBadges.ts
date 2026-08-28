"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [externalGrant, setExternalGrant] = useState<BadgeDef | null>(null);
  const [pendingCelebrations, setPendingCelebrations] = useState<BadgeDef[]>([]);
  const earnedIdsRef = useRef(earnedIds);
  const pendingCheckedRef = useRef(false);

  useEffect(() => {
    earnedIdsRef.current = earnedIds;
  }, [earnedIds]);

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

  /**
   * 관리자가 "뱃지 직접 부여"로 다른 화면에서 뱃지를 줬을 때 학생 화면에도 실시간으로 반영되도록
   * user_badges의 insert/delete를 구독한다. 내가 스스로 지급받은 경우(자동/날짜 조건)는 그 즉시
   * 로컬 상태에 이미 반영돼 있어서, 여기서는 "아직 모르는" 지급만 골라내 externalGrant로 알린다.
   * 지금 접속 중이라 바로 보여줄 수 있으므로, 이 경로로 받은 지급은 celebrated=true로 표시한다.
   */
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user_badges_watch_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_badges", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as { badge_id: string; celebrated: boolean };
          if (earnedIdsRef.current.has(row.badge_id)) return;
          const { data: badge } = await supabase.from("badges").select("*").eq("id", row.badge_id).single();
          if (!badge) return;
          setEarnedIds((prev) => new Set([...prev, row.badge_id]));
          setExternalGrant(badge as BadgeDef);
          if (!row.celebrated) {
            await supabase.from("user_badges").update({ celebrated: true }).eq("user_id", userId).eq("badge_id", row.badge_id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "user_badges", filter: `user_id=eq.${userId}` },
        (payload) => {
          const badgeId = (payload.old as { badge_id: string }).badge_id;
          setEarnedIds((prev) => {
            if (!prev.has(badgeId)) return prev;
            const next = new Set(prev);
            next.delete(badgeId);
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  /**
   * 접속 중이 아닐 때 관리자가 부여한 뱃지는 위 실시간 구독으로 못 받으므로, 접속할 때마다
   * "아직 축하 못 받은(celebrated=false)" 뱃지가 있는지 한 번 확인해서 놓친 축하를 몰아서 띄운다.
   */
  useEffect(() => {
    if (!userId || pendingCheckedRef.current) return;
    pendingCheckedRef.current = true;
    (async () => {
      const { data: rows } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId)
        .eq("celebrated", false);
      if (!rows || rows.length === 0) return;
      const badgeIds = rows.map((r) => r.badge_id);
      const { data: badgeRows } = await supabase.from("badges").select("*").in("id", badgeIds);
      if (badgeRows && badgeRows.length > 0) {
        setPendingCelebrations(badgeRows as BadgeDef[]);
      }
      await supabase.from("user_badges").update({ celebrated: true }).eq("user_id", userId).in("badge_id", badgeIds);
    })();
  }, [userId, supabase]);

  const clearExternalGrant = useCallback(() => setExternalGrant(null), []);
  const clearPendingCelebrations = useCallback(() => setPendingCelebrations([]), []);

  /** 오늘 날짜가 뱃지의 날짜 조건(이전/이후/당일/기간)을 만족하는지 확인합니다. */
  const matchesDateCondition = (b: BadgeDef, today: string) => {
    if (!b.date_condition || !b.date_condition_value) return false;
    if (b.date_condition === "before") return today < b.date_condition_value;
    if (b.date_condition === "after") return today > b.date_condition_value;
    if (b.date_condition === "between") {
      if (!b.date_condition_value_end) return false;
      return today >= b.date_condition_value && today <= b.date_condition_value_end;
    }
    return today === b.date_condition_value;
  };

  /**
   * 아직 못 받은 뱃지 중 조건을 만족하는 것들을 실제로 지급합니다(공용 로직). 지급 즉시 호출한
   * 쪽에서 축하 팝업을 보여줄 것이므로 celebrated=true로 기록한다.
   */
  const grant = useCallback(
    async (toGrant: BadgeDef[]) => {
      if (!userId || toGrant.length === 0) return [];
      const { error } = await supabase
        .from("user_badges")
        .insert(toGrant.map((b) => ({ user_id: userId, badge_id: b.id, celebrated: true })));
      if (!error) {
        setEarnedIds((prev) => new Set([...prev, ...toGrant.map((b) => b.id)]));
      }
      return toGrant;
    },
    [userId, supabase]
  );

  /** 새로 달성한 스트릭 값을 기준으로, 아직 못 받은 연속 접속 뱃지가 있으면 지급하고 반환합니다. */
  const checkMilestones = useCallback(
    async (streak: number) => {
      if (!userId) return [];
      const newlyEarned = badges.filter(
        (b) => b.award_type === "auto" && !earnedIds.has(b.id) && b.streak_threshold !== null && b.streak_threshold <= streak
      );
      return grant(newlyEarned);
    },
    [userId, badges, earnedIds, grant]
  );

  /**
   * 오늘 날짜를 기준으로 날짜 조건 뱃지를 확인해 지급합니다. 연속 접속과 달리 "새 체크인" 이벤트에
   * 묶여있지 않고 로그인해서 사이트에 들어오기만 하면 되는 조건이라, 이미 오늘 체크인을 마친
   * 사용자(예: 뱃지가 생기기 전에 먼저 접속했던 사용자)도 다시 접속할 때마다 평가되어야 한다.
   */
  const checkDateBadges = useCallback(async () => {
    if (!userId) return [];
    const today = new Date().toISOString().slice(0, 10);
    const newlyEarned = badges.filter(
      (b) => b.award_type === "date" && !earnedIds.has(b.id) && matchesDateCondition(b, today)
    );
    return grant(newlyEarned);
  }, [userId, badges, earnedIds, grant]);

  return {
    badges,
    earnedIds,
    loading,
    checkMilestones,
    checkDateBadges,
    externalGrant,
    clearExternalGrant,
    pendingCelebrations,
    clearPendingCelebrations,
    reload: load,
  };
}
