"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import { todayKST } from "@/lib/date";
import type { EventItem } from "@/lib/types";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

type EventWithCreator = EventItem & { creator_name: string | null };

export default function CalendarPage() {
  useTrackPageVisit("calendar"); // "탐험가" 뱃지용 방문 기록
  const { rows: events } = useRealtimeList<EventWithCreator>("events", {
    selectFrom: "events_with_creator",
    orderBy: { column: "start_at" },
  });
  const [mode, setMode] = useState<"month" | "list">("month");
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
    const map: Record<string, EventWithCreator[]> = {};
    events.forEach((e) => {
      map[e.start_at] = map[e.start_at] || [];
      map[e.start_at].push(e);
    });
    return map;
  }, [events]);

  return (
    <div>
      <SectionTitle
        eyebrow="SCHEDULE"
        title="일정"
        action={
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${mode === "month" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setMode("month")}
            >
              월간
            </button>
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${mode === "list" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setMode("list")}
            >
              목록
            </button>
          </div>
        }
      />
      {mode === "month" ? (
        <div className="bg-white border border-border rounded-2xl p-[18px]">
          <div className="flex justify-center items-center gap-4 mb-3">
            <button
              className="bg-[#F2F4F8] w-7 h-7 rounded-md"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              ‹
            </button>
            <strong>{year}년 {month + 1}월</strong>
            <button
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
                  {evs.slice(0, 2).map((e) => (
                    <Link
                      href={`/events/${e.id}`}
                      key={e.id}
                      className="block bg-blue text-white rounded px-1 mb-0.5 truncate"
                    >
                      {e.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="list-none m-0 p-0">
          {[...events].sort((a, b) => a.start_at.localeCompare(b.start_at)).map((e) => (
            <li key={e.id} className="border-b border-border py-2.5">
              <Link href={`/events/${e.id}`} className="flex items-center gap-2 hover:opacity-70">
                <Badge color="navy">{e.category}</Badge>
                <span className="flex-1 text-sm">{e.title}</span>
                <span className="text-xs text-muted">{e.creator_name || "등록자 정보 없음"}</span>
                <span className="text-xs text-muted">{fmt(e.start_at)}</span>
              </Link>
            </li>
          ))}
          {events.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 일정이 없습니다.</div>}
        </ul>
      )}
    </div>
  );
}
