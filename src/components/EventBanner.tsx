"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";
import type { SpecialEvent } from "@/lib/types";

/**
 * 홈 화면 상단 고정 배너 — 진행중인(오늘이 start_date~end_date 사이, is_hidden=false인)
 * special_events가 있으면 보여주고, 없으면 아무것도 렌더링하지 않는다. main-editor
 * 블록 체계(노출/순서/너비 설정)와는 별개의 고정 배치 — 비용 대비 단순한 쪽을 선택(사용자 확인).
 */
export default function EventBanner() {
  const [event, setEvent] = useState<SpecialEvent | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const today = todayKST();
    supabase
      .from("special_events")
      .select("*")
      .eq("is_hidden", false)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setEvent(data as SpecialEvent | null));
  }, []);

  if (!event) return null;

  return (
    <Link
      href={`/events-special/${event.id}`}
      className="flex items-center gap-3 bg-gradient-to-r from-appleBlue to-blue-400 text-white rounded-2xl p-3.5 mb-4 hover:opacity-95 transition-opacity"
    >
      {event.poster_image_url && (
        <img src={event.poster_image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-white/80">진행중인 이벤트</div>
        <div className="font-bold truncate">{event.title}</div>
      </div>
      <span className="text-sm font-bold shrink-0">자세히 보기 →</span>
    </Link>
  );
}
