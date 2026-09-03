"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAttendance } from "@/hooks/useAttendance";
import { useBadges } from "@/hooks/useBadges";
import type { BadgeDef } from "@/lib/types";

/**
 * 접속하면 버튼 클릭 없이 자동으로 오늘 체크인을 하고,
 * 완료 토스트(+획득한 뱃지가 있으면 축하 모달)를 띄우는 훅.
 * StreakBar(홈)와 마이페이지에서 공용으로 사용한다.
 *
 * 사이트 잠금(점검) 모드가 켜져 있는 동안은 아직 정식 운영이 아니므로 연속 접속
 * 체크인/토스트/뱃지 축하 팝업 같은 상호작용을 전부 보류한다(단, 날짜 조건 뱃지는
 * "잠금 중에 로그인하면 지급"이 목적이라 예외 — 지급은 조용히 계속하되 축하 팝업만 숨긴다).
 *
 * checkInEligible이 false면(명단 밖에서 "외부 계정 관리"로 개별 승인된 계정 등, 실제
 * 학교 구성원이 아닌 경우) 연속 접속 체크인 자체를 하지 않는다 — 이 기능은 학생/교사를
 * 위한 것이라 그 외 계정에게 "접속 1일째" 같은 팝업이 뜨는 게 맞지 않기 때문이다.
 */
export function useAutoCheckIn(userId: string | null, isLockdownExempt: boolean = false, checkInEligible: boolean = true) {
  const supabase = createClient();
  const attendance = useAttendance(userId);
  const {
    badges,
    earnedIds,
    loading: badgesLoading,
    checkMilestones,
    checkDateBadges,
  } = useBadges(userId);
  const [toast, setToast] = useState<{ streak: number; streakReset: boolean } | null>(null);
  // 축하할 뱃지가 여러 개 겹칠 수 있어(연속 접속 여러 단계 동시 달성, 접속 안 한 사이 관리자가
  // 여러 개 부여 등) 큐로 관리하고 하나씩 순서대로 보여준다.
  const [celebrateQueue, setCelebrateQueue] = useState<BadgeDef[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
  // 어제 접속을 안 해서 프리즈가 필요한 상황(freezeEligible)이고 프리즈를 보유하고 있으면,
  // 자동으로 소비하지 않고 이 상태를 채워서 화면에 선택 모달을 띄운 뒤 응답을 기다린다.
  const [freezePrompt, setFreezePrompt] = useState<{ streak: number; streakIfUsed: number; freezeCredits: number } | null>(null);
  const firedRef = useRef(false);
  const dateCheckedRef = useRef(false);

  const commitCheckIn = async (useFreeze: boolean, streakReset: boolean) => {
    const nextStreak = await attendance.checkIn(useFreeze);
    if (nextStreak) {
      const newly = await checkMilestones(nextStreak);
      if (!maintenanceMode) {
        setToast({ streak: nextStreak, streakReset });
        pushCelebrations(newly);
      }
    }
  };

  const pushCelebrations = (list: BadgeDef[]) => {
    if (list.length === 0) return;
    setCelebrateQueue((q) => [...q, ...list]);
  };

  useEffect(() => {
    if (isLockdownExempt) {
      setMaintenanceMode(false);
      return;
    }
    supabase
      .from("site_settings")
      .select("maintenance_mode")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => setMaintenanceMode(!!data?.maintenance_mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLockdownExempt]);

  useEffect(() => {
    if (!userId || attendance.loading || attendance.checkedToday || firedRef.current) return;
    if (maintenanceMode === null) return; // 아직 점검 모드 여부를 확인 전이면 보류(값이 오면 다시 판단)
    if (!checkInEligible) return; // 학교 구성원이 아닌 계정(외부 승인 계정)은 체크인하지 않음
    // badges 목록/보유 뱃지(earnedIds)가 아직 로딩 중이면 기다린다 — 여기서 바로 checkMilestones를
    // 부르면 오래된(비어있는) earnedIds를 기준으로 판단해 이미 받은 뱃지를 "새로 획득"으로 잘못
    // 인식할 수 있다(예: 이미 3일 뱃지가 있는데 재접속 시 축하 팝업이 다시 뜨는 버그).
    if (badgesLoading) return;

    // 어제 접속을 안 해서 프리즈가 필요한 상황이고 프리즈를 보유하고 있으면, 자동으로 쓰지
    // 않고 학생에게 먼저 물어본다 — 응답이 오기 전까지는 체크인 자체를 아예 하지 않는다
    // (정확히 한 번만 기록되고 streak도 정확히 한 번만 바뀌게 하기 위해, "물어보기"와
    // "기록하기"를 분리해서 응답 후에만 commitCheckIn을 호출한다).
    if (attendance.freezeEligible && attendance.freezeCredits > 0) {
      firedRef.current = true;
      setFreezePrompt({
        streak: attendance.streak,
        streakIfUsed: attendance.streak + 1,
        freezeCredits: attendance.freezeCredits,
      });
      return;
    }

    firedRef.current = true;
    // 프리즈가 필요한 상황인데 보유한 프리즈가 없으면, 선택지 없이 바로 기록하고(정상
    // 접속으로 인정) streak는 리셋된다는 안내만 토스트에 덧붙인다.
    const streakWillReset = attendance.freezeEligible && attendance.freezeCredits === 0;
    // 잠금 모드 중에도 실제 접속 기록(user_attendance)은 그대로 남겨야 접속 통계가
    // 정확하다 — 예전엔 이 블록 전체가 잠금 중에는 실행조차 안 돼서, 사전 로그인한
    // 학생들의 방문 기록이 하나도 안 쌓이는 문제가 있었다. 축하 토스트/뱃지 팝업 같은
    // "정식 운영 전에 보여주기 애매한" 연출만 잠금 중에는 숨기고, 체크인 자체와 날짜
    // 조건 뱃지처럼 조용히 지급되는 것(checkMilestones)은 계속 진행한다.
    commitCheckIn(false, streakWillReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attendance.loading, attendance.checkedToday, maintenanceMode, badgesLoading]);

  const resolveFreezePrompt = (useFreeze: boolean) => {
    setFreezePrompt(null);
    // "프리즈가 없어서 초기화" 안내는 프리즈가 아예 없어서 선택지 없이 자동으로 리셋되는
    // 경우에만 보여준다 — 여기서는 프리즈를 보유한 채로 학생이 직접 "사용 안 함"을
    // 골랐으니 이미 모달에서 결과를 알고 선택한 것이라 같은 안내를 또 띄우지 않는다.
    commitCheckIn(useFreeze, false);
  };

  // 날짜 조건 뱃지는 "새 체크인" 이벤트가 아니라 "오늘 로그인해서 사이트에 들어왔는지"만 보므로,
  // 이미 오늘 체크인을 마친 사용자(뱃지가 생기기 전에 먼저 접속했던 사용자 포함)도 접속할 때마다
  // 별도로 평가한다. 잠금 모드 중에도 지급은 계속하되(그게 목적이므로), 축하 팝업만 숨긴다.
  useEffect(() => {
    if (!userId || badgesLoading || dateCheckedRef.current || !checkInEligible) return;
    dateCheckedRef.current = true;
    (async () => {
      const newly = await checkDateBadges();
      if (!maintenanceMode) pushCelebrations(newly);
    })();
  }, [userId, badgesLoading, checkDateBadges, maintenanceMode]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 관리자가 "뱃지 직접 부여"로 지급한 뱃지의 축하 팝업은 더 이상 여기서 처리하지 않는다
  // — BadgeGrantWatcher(NotificationBanner와 동일한 구조의 독립 컴포넌트, (site)/layout.tsx에
  // Header와 형제로 마운트됨)가 전담한다. 이 훅을 거치던 중계 단계(useBadges -> 여기 ->
  // Header)가 알림 배너보다 체감이 느린 원인이었어서, 그 경로를 아예 없앴다. 여기
  // celebrateQueue는 이제 "내가 직접 달성한" 연속 접속/날짜 조건 뱃지 축하만 담당한다
  // (realtime과 무관하게 로컬 즉시 처리).

  return {
    streak: attendance.streak,
    history: attendance.history,
    checkedToday: attendance.checkedToday,
    freezeCredits: attendance.freezeCredits,
    loading: attendance.loading,
    badges,
    earnedIds,
    toast,
    celebrate: celebrateQueue[0] ?? null,
    dismissCelebrate: () => setCelebrateQueue((q) => q.slice(1)),
    freezePrompt,
    resolveFreezePrompt,
  };
}
