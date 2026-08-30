"use client";

import { useState } from "react";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import Badge from "@/components/Badge";
import OrgEventsCalendarGrid from "@/components/OrgEventsCalendarGrid";
import { EVENT_CATEGORY_LABEL, fmtDateTime } from "./helpers";
import type { Organization, OrgEvent } from "@/lib/types";

// 어느 부서가 부서 일정(org_events)을 등록하든, 새 데이터를 따로 저장하지 않고 기존
// org_events를 부서 구분 없이 전부 모아서 보여준다(요청사항: 새 테이블 없이 재사용).
// 부서 필터 UI는 상위(OrgActivitiesPage)에서 이 탭일 때 숨긴다 — 전체를 한눈에 보는 게
// 이 캘린더의 목적이라 필터를 두지 않았다.
export default function ExecutiveCalendarTab({ orgs }: { orgs: Organization[] }) {
  const { rows: events } = useRealtimeList<OrgEvent>("org_events", { orderBy: { column: "start_at" } });
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";
  // "캘린더"라는 이름과 다르게 원래 목록으로만 보여주고 있던 것을, 진짜 월간 달력으로
  // 바꾸고 목록 보기는 예전처럼 선택할 수 있게 남겨뒀다.
  const [mode, setMode] = useState<"month" | "list">("month");

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <p className="text-muted text-sm m-0">
          모든 부서의 일정을 한곳에 모아 보여주는 학생회 임원회 전용 캘린더입니다.
        </p>
        <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
          <button
            type="button"
            className={`px-3.5 py-1.5 text-sm font-semibold ${mode === "month" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setMode("month")}
          >
            월간
          </button>
          <button
            type="button"
            className={`px-3.5 py-1.5 text-sm font-semibold ${mode === "list" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setMode("list")}
          >
            목록
          </button>
        </div>
      </div>

      {mode === "month" ? (
        <OrgEventsCalendarGrid
          events={events}
          categoryLabel={EVENT_CATEGORY_LABEL}
          renderExtra={(e) => `${orgName(e.org_id)} · ${e.title}`}
        />
      ) : (
        <ul className="list-none m-0 p-0">
          {events.map((e) => (
            <li key={e.id} className="border-b border-border py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color="gold">{orgName(e.org_id)}</Badge>
                <Badge color="navy">{EVENT_CATEGORY_LABEL[e.category]}</Badge>
                <span className="flex-1 text-sm font-bold">{e.title}</span>
              </div>
              <div className="text-xs text-muted mt-1">
                {fmtDateTime(e.start_at)} ~ {fmtDateTime(e.end_at)}
                {e.location ? ` · ${e.location}` : ""}
              </div>
              {e.description && <p className="text-sm mt-1">{e.description}</p>}
            </li>
          ))}
          {events.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 부서 일정이 없습니다.</div>}
        </ul>
      )}
    </div>
  );
}
