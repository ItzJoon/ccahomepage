"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";
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
  const [pendingCelebrations, setPendingCelebrations] = useState<BadgeDef[]>([]);
  // Header(useAutoCheckIn)와 마이페이지가 동시에 useBadges를 호출하면 같은 사용자에 대해
  // 채널이 두 번 생기는데, 이름이 겹치면 realtime 구독끼리 충돌한다(useRealtimeList와 동일 문제).
  // 인스턴스마다 고유한 채널 이름을 쓰도록 랜덤값을 섞는다.
  const channelSuffixRef = useRef(Math.random().toString(36).slice(2));

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
   * user_badges 변경을 구독한다. 알림 센터(NotificationCenter/useRealtimeList)와 동일한 방식으로
   * 통일했다 — payload.new/old를 직접 읽어 상태를 조립하는 대신, 변경이 있었다는 신호만 받고
   * 실제 데이터는 항상 REST로 다시 조회한다(checkPending). 이렇게 하면 이전처럼 INSERT/DELETE를
   * 각각 다른 방식으로 처리할 필요가 없고, replica identity 설정에도 의존하지 않는다.
   *
   * "아직 축하 못 받은(celebrated=false)" 뱃지 확인은 실시간 이벤트 콜백뿐 아니라 접속 시
   * 즉시 + 주기적으로도 반복한다 — Supabase Realtime은 동시 접속자가 없으면 프로젝트의
   * realtime tenant 자체가 유휴 상태로 내려갔다가(약 60초 후) 다음 접속 때 콜드스타트되는데,
   * 이 재시작 구간과 겹치면 postgres_changes 이벤트가 조용히 누락될 수 있다(실시간 로그에서
   * 24시간 동안 tenant가 30번 넘게 종료/재시작된 것을 확인함). 코드에서 그 재시작 타이밍을
   * 직접 제어할 수는 없으니, 실시간이 정상 동작하면 즉시 뜨고 혹시 놓쳐도 POLL_INTERVAL_MS
   * 안에는 폴링이 잡아내도록 이중 안전망을 둔다.
   */
  const checkPending = useCallback(async () => {
    if (!userId) return;
    const { data: rows } = await supabase.from("user_badges").select("badge_id, celebrated").eq("user_id", userId);
    const all = rows ?? [];
    // 지급/회수를 모두 반영해 earnedIds를 항상 DB와 동기화한다(관리자가 뱃지를 회수한
    // 경우도 이 재조회 한 번으로 자연히 처리됨 — 예전처럼 DELETE 페이로드를 따로 다룰
    // 필요가 없다).
    setEarnedIds(new Set(all.map((r) => r.badge_id)));
    const uncelebratedIds = all.filter((r) => !r.celebrated).map((r) => r.badge_id);
    if (uncelebratedIds.length === 0) return;
    const { data: badgeRows } = await supabase.from("badges").select("*").in("id", uncelebratedIds);
    if (badgeRows && badgeRows.length > 0) {
      setPendingCelebrations((prev) => {
        const known = new Set(prev.map((b) => b.id));
        const fresh = (badgeRows as BadgeDef[]).filter((b) => !known.has(b.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    }
    await supabase.rpc("mark_badges_celebrated", { target_badge_ids: uncelebratedIds });
  }, [userId, supabase]);

  useEffect(() => {
    if (!userId) return;
    const POLL_INTERVAL_MS = 20000;
    checkPending();
    const channel = supabase
      .channel(`user_badges_watch_${userId}_${channelSuffixRef.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges" }, () => checkPending())
      .subscribe();
    const interval = setInterval(checkPending, POLL_INTERVAL_MS);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId, supabase, checkPending]);

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
   *
   * earnedIds는 useBadges가 아직 로딩 중일 때 호출되면(예: 체크인 직후 badges 목록이 채 안
   * 불러와진 시점) 오래된 값일 수 있어, 이미 보유한 뱃지를 "새로 획득"으로 잘못 판단할 수 있다.
   * 그래서 일반 insert 대신 `on conflict (user_id, badge_id) do nothing` + `.select()`를 써서,
   * DB에 실제로 새로 들어간 행만 결과로 받는다 — 이미 있던 뱃지는 조용히 무시되고(에러도 안 남),
   * 그 뱃지에 대한 축하 팝업도 뜨지 않는다(이미 받은 뱃지가 재접속 때마다 다시 축하되는 버그 방지).
   */
  const grant = useCallback(
    async (toGrant: BadgeDef[]) => {
      if (!userId || toGrant.length === 0) return [];
      const { data, error } = await supabase
        .from("user_badges")
        .upsert(
          toGrant.map((b) => ({ user_id: userId, badge_id: b.id, celebrated: true })),
          { onConflict: "user_id,badge_id", ignoreDuplicates: true }
        )
        .select("badge_id");
      if (error || !data) return [];
      const insertedIds = new Set(data.map((r) => r.badge_id));
      const actuallyGranted = toGrant.filter((b) => insertedIds.has(b.id));
      if (actuallyGranted.length > 0) {
        setEarnedIds((prev) => new Set([...prev, ...actuallyGranted.map((b) => b.id)]));
      }
      return actuallyGranted;
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
    const today = todayKST();
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
    pendingCelebrations,
    clearPendingCelebrations,
    reload: load,
  };
}
