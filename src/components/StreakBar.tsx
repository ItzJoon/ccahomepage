"use client";

import { useAttendance } from "@/hooks/useAttendance";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import ListSkeleton from "@/components/ListSkeleton";
import type { HomeThemeKey } from "@/lib/homeTheme";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * 실제 체크인/토스트/뱃지 축하는 Header에서 사이트 전역으로 처리하고,
 * 여기서는 홈 화면에 현재 스트릭 상태만 표시한다.
 *
 * userId는 undefined(로그인 확인 중)/null(비로그인 확정)/string(로그인됨) 세 가지로
 * 구분한다 — 예전엔 null 하나로 "확인 중"까지 같이 나타내서, 실제로는 로그인한
 * 사용자에게도 확인이 끝나기 전 짧게 "로그인하면 볼 수 있어요" 문구가 잘못 보였다.
 */
export default function StreakBar({ userId, initialThemeKey }: { userId: string | null | undefined; initialThemeKey?: HomeThemeKey }) {
  const { streak, checkedToday, history, loading } = useAttendance(userId ?? null);
  const { t } = useHomeTheme(initialThemeKey);

  // 로그인 여부를 아직 모르거나(userId===undefined), 알고 있고 로그인 상태라 실제
  // 데이터를 불러오는 중이면(loading) — 두 경우 모두 같은 카드 크기(t.streakCard)의
  // 스켈레톤을 보여줘서, 로딩 완료 후 실제 내용으로 바뀔 때 카드 크기가 그대로
  // 유지되게 한다(크기 안 맞음/깜빡임 방지).
  if (userId === undefined || (userId && loading)) {
    return (
      <div className={t.streakCard}>
        <ListSkeleton rows={1} rowClassName="h-5 w-48 rounded bg-[#EEF1F6] dark:bg-white/10" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className={`flex justify-between items-center text-sm text-muted ${t.streakCard}`}>
        로그인하면 연속 접속일수와 방문 기록을 확인할 수 있어요.
      </div>
    );
  }

  return (
    <div className={`flex justify-between items-center flex-wrap gap-2.5 ${t.streakCard}`}>
      <div>
        <strong>
          {t.streakEmoji}연속 접속 {streak}일째
        </strong>
        <span className="text-muted"> · 최근 방문 {history[0] ? fmt(history[0]) : "기록 없음"}</span>
      </div>
      {checkedToday && (
        <span className={t.streakBadge}>
          <span className={t.streakBadgeDot} />
          오늘 접속 완료{t.streakCheckmark}
        </span>
      )}
    </div>
  );
}
