import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import DetailBackLink from "@/components/DetailBackLink";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: event } = await supabase.from("events_with_creator").select("*").eq("id", params.id).single();
  if (!event) return <div className="text-muted text-center py-10">일정을 찾을 수 없습니다.</div>;

  const { data: attachments } = await supabase.from("attachments").select("*").eq("event_id", params.id);

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <DetailBackLink href="/calendar" label="일정으로" />
      <div className="flex items-center gap-2 flex-wrap my-2">
        <Badge color="navy" className="shrink-0">{event.category}</Badge>
        <h1 className="text-2xl m-0 min-w-0">{event.title}</h1>
      </div>
      <div className="text-muted text-sm mb-[18px]">
        {fmt(event.start_at)} {event.end_at ? `~ ${fmt(event.end_at)}` : ""} · {event.location || "장소 미정"}
        {" · "}등록자 {event.creator_name || "정보 없음"}
      </div>
      <div className="leading-8 whitespace-pre-wrap text-[15px]">
        {event.description ? <Linkify text={event.description} /> : "상세 설명이 없습니다."}
      </div>
      {attachments && attachments.length > 0 && (
        <div className="mt-5 p-3.5 bg-bg rounded-xl">
          <div className="font-bold text-xs mb-1.5">첨부파일</div>
          {attachments.map((a) => (
            <a key={a.id} href={a.file_url} className="block text-sm py-1 text-blue">
              📎 {a.file_name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
