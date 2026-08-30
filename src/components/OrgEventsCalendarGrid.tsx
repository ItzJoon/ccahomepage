"use client";

import { useMemo, useState } from "react";
import { todayKST, toKSTDateString } from "@/lib/date";
import type { OrgEvent } from "@/lib/types";

/**
 * 부서 일정(org_events)용 월간 캘린더 그리드. 학사일정(`/calendar`)의 월간 뷰와 같은
 * 구조를 그대로 따라서(달력 UX를 사이트 전체에서 통일), 관리자 화면(OrgEventsManager)과
 * 학생/임원회 화면(EventsTab, ExecutiveCalendarTab) 세 군데에서 공용으로 쓴다.
 *
 * org_events.start_at은 events.start_at(date 타입)과 달리 timestamptz라서, 방문자의
 * 브라우저 타임존에 기대지 않고 한국 시간(KST) 기준으로 날짜 칸에 묶는다(toKSTDateString).
 */
export default function OrgEventsCalendarGrid<T extends OrgEvent>({
  events,
  categoryLabel,
  renderExtra,
  onEventClick,
}: {
  events: T[];
  categoryLabel: Record<OrgEvent["category"], string>;
  /** 이벤트 칸에 배지 등 추가 정보를 덧붙이고 싶을 때(예: 임원회 캘린더의 부서명 배지). */
  renderExtra?: (event: T) => React.ReactNode;
  /** 관리자 화면에서 캘린더 칸을 눌러 바로 수정 폼을 열고 싶을 때. */
  onEventClick?: (event: T) => void;
}) {
  const [cursor, setCursor] = useState(new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsByDate = useMemo(() => {
    const map: Record<string, T[]> = {};
    events.forEach((e) => {
      const dateStr = toKSTDateString(e.start_at);
      (map[dateStr] ||= []).push(e);
    });
    return map;
  }, [events]);

  return (
    <div className="bg-white border border-border rounded-2xl p-[18px]">
      <div className="flex justify-center items-center gap-4 mb-3">
        <button
          type="button"
          className="bg-[#F2F4F8] w-7 h-7 rounded-md"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <strong>{year}년 {month + 1}월</strong>
        <button
          type="button"
          className="bg-[#F2F4F8] w-7 h-7 rounded-md"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted font-bold mb-1.5">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const evs = eventsByDate[dateStr] || [];
          const isToday = dateStr === todayKST();
          return (
            <div
              key={i}
              className={`min-h-[76px] border rounded-lg p-1 text-xs ${
                isToday ? "border-gold bg-[#FFF9EE]" : "border-border"
              }`}
            >
              <div className="font-bold mb-1">{d}</div>
              {evs.slice(0, 3).map((e) => (
                <div
                  key={e.id}
                  className={`bg-blue text-white rounded px-1 mb-0.5 truncate ${onEventClick ? "cursor-pointer hover:bg-navy" : ""}`}
                  title={e.title}
                  onClick={onEventClick ? () => onEventClick(e) : undefined}
                >
                  {renderExtra ? renderExtra(e) : e.title}
                </div>
              ))}
              {evs.length > 3 && <div className="text-muted">+{evs.length - 3}건 더</div>}
            </div>
          );
        })}
      </div>
      {events.length === 0 && (
        <p className="text-muted text-center py-4 text-sm">등록된 일정이 없습니다.</p>
      )}
      <p className="text-muted text-[11px] mt-2">분류: {Object.values(categoryLabel).join(" · ")}</p>
    </div>
  );
}
