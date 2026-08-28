"use client";

import { useEffect, useRef, useState } from "react";
import { useAttendance } from "@/hooks/useAttendance";
import { useBadges } from "@/hooks/useBadges";
import type { BadgeDef } from "@/lib/types";

/**
 * 접속하면 버튼 클릭 없이 자동으로 오늘 체크인을 하고,
 * 완료 토스트(+획득한 뱃지가 있으면 축하 모달)를 띄우는 훅.
 * StreakBar(홈)와 마이페이지에서 공용으로 사용한다.
 */
export function useAutoCheckIn(userId: string | null) {
  const attendance = useAttendance(userId);
  const { badges, earnedIds, checkMilestones } = useBadges(userId);
  const [toast, setToast] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<BadgeDef | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!userId || attendance.loading || attendance.checkedToday || firedRef.current) return;
    firedRef.current = true;
    (async () => {
      const nextStreak = await attendance.checkIn();
      if (nextStreak) {
        setToast(nextStreak);
        const newly = await checkMilestones(nextStreak);
        if (newly.length > 0) setCelebrate(newly[newly.length - 1]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attendance.loading, attendance.checkedToday]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    streak: attendance.streak,
    history: attendance.history,
    checkedToday: attendance.checkedToday,
    freezeCredits: attendance.freezeCredits,
    loading: attendance.loading,
    badges,
    earnedIds,
    toast,
    celebrate,
    dismissCelebrate: () => setCelebrate(null),
  };
}
