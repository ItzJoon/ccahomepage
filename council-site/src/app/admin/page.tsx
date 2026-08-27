import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = createClient();
  const [{ count: noticeCount }, { count: newsCount }, { count: eventCount }, { data: pendingQ }, { count: scheduledCount }] =
    await Promise.all([
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("type", "notice"),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("type", "news"),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("questions").select("id").eq("status", "pending"),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
    ]);

  return (
    <div>
      <h2 className="text-[22px] mb-4">관리자 대시보드</h2>
      <div className="flex gap-3 flex-wrap mb-5">
        <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[130px]">
          <div className="font-serif font-black text-2xl">{noticeCount ?? 0}</div>
          <div className="text-sm text-muted">공지사항</div>
        </div>
        <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[130px]">
          <div className="font-serif font-black text-2xl">{newsCount ?? 0}</div>
          <div className="text-sm text-muted">뉴스</div>
        </div>
        <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[130px]">
          <div className="font-serif font-black text-2xl">{eventCount ?? 0}</div>
          <div className="text-sm text-muted">등록 일정</div>
        </div>
        <Link href="/admin/qna" className="bg-white border border-gold rounded-xl px-5 py-4 min-w-[130px]">
          <div className="font-serif font-black text-2xl">{pendingQ?.length ?? 0}</div>
          <div className="text-sm text-muted">답변 대기 Q&amp;A</div>
        </Link>
        <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[130px]">
          <div className="font-serif font-black text-2xl">{scheduledCount ?? 0}</div>
          <div className="text-sm text-muted">예약 발행 대기</div>
        </div>
      </div>
      <div className="flex gap-2.5 flex-wrap">
        <Link href="/admin/notices" className="bg-gold text-white font-bold text-sm rounded-lg px-[18px] py-2.5">
          + 새 공지 작성
        </Link>
        <Link href="/admin/notify" className="border border-navy text-navy font-bold text-sm rounded-lg px-[18px] py-2.5">
          + 실시간 알림 발송
        </Link>
        <Link href="/admin/events" className="border border-navy text-navy font-bold text-sm rounded-lg px-[18px] py-2.5">
          + 일정 등록
        </Link>
      </div>
    </div>
  );
}
