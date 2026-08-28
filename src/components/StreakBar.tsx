"use client";

import { useAutoCheckIn } from "@/hooks/useAutoCheckIn";
import BadgeCelebration from "@/components/BadgeCelebration";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function StreakBar({ userId }: { userId: string | null }) {
  const { streak, checkedToday, history, loading, toast, celebrate, dismissCelebrate } = useAutoCheckIn(userId);

  if (!userId) {
    return (
      <div className="flex justify-between items-center bg-white border border-border rounded-xl px-4 py-3 mb-5 text-sm text-muted">
        로그인하면 연속 접속일수와 방문 기록을 확인할 수 있어요.
      </div>
    );
  }
  if (loading) return null;

  return (
    <>
      <div className="flex justify-between items-center bg-white border border-border rounded-xl px-4 py-3 mb-5 flex-wrap gap-2.5">
        <div>
          <strong>🔥 연속 접속 {streak}일째</strong>
          <span className="text-muted"> · 최근 방문 {history[0] ? fmt(history[0]) : "기록 없음"}</span>
        </div>
        {checkedToday && <span className="text-teal font-bold text-sm">오늘 접속 완료 ✓</span>}
      </div>

      {toast !== null && (
        <div className="fixed bottom-5 right-5 z-40 bg-navy text-white rounded-xl px-4 py-3 shadow-lg text-sm flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <span>오늘 접속 체크 완료! 연속 {toast}일째</span>
        </div>
      )}
      {celebrate && <BadgeCelebration badge={celebrate} onClose={dismissCelebrate} />}
    </>
  );
}
