"use client";

import Link from "next/link";
import { useList } from "@/hooks/useList";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import ListSkeleton from "@/components/ListSkeleton";
import type { SpecialEvent } from "@/lib/types";

export default function EventsSpecialPage() {
  useTrackPageVisit("events_special");
  const { rows, loading } = useList<SpecialEvent>("special_events", {
    filter: (q) => q.eq("is_hidden", false),
    orderBy: { column: "start_date", ascending: false },
  });

  return (
    <div>
      <SectionTitle eyebrow="EVENTS" title="이벤트" />
      {loading && rows.length === 0 ? (
        <ListSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rows.map((e) => (
            <Link href={`/events-special/${e.id}`} key={e.id} className="border border-border rounded-xl overflow-hidden block bg-surface hover:border-blue">
              {e.poster_image_url && (
                <img src={e.poster_image_url} alt={e.title} className="w-full aspect-square object-cover" />
              )}
              <div className="p-4">
                <div className="font-bold mb-1.5">{e.title}</div>
                <div className="text-xs text-muted">{e.start_date} ~ {e.end_date}</div>
              </div>
            </Link>
          ))}
          {rows.length === 0 && <div className="text-muted text-center py-8 text-sm col-span-3">등록된 이벤트가 없습니다.</div>}
        </div>
      )}
    </div>
  );
}
