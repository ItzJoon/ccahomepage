"use client";

import { useAttendance } from "@/hooks/useAttendance";
import { useHomeTheme } from "@/hooks/useHomeTheme";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * 실제 체크인/토스트/뱃지 축하는 Header에서 사이트 전역으로 처리하고,
 * 여기서는 홈 화면에 현재 스트릭 상태만 표시한다.
 */
export default function StreakBar({ userId }: { userId: string | null }) {
  const { streak, checkedToday, history, loading } = useAttendance(userId);
  const { t } = useHomeTheme();

  if (!userId) {
    return (
      <div className={`flex justify-between items-center text-sm text-muted ${t.streakCard}`}>
        로그인하면 연속 접속일수와 방문 기록을 확인할 수 있어요.
      </div>
    );
  }
  if (loading) return null;

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
