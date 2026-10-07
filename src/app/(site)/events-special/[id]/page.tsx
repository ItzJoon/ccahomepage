import type { Metadata } from "next";
import { cache } from "react";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import DetailBackLink from "@/components/DetailBackLink";
import EventSpecialDetailClient from "@/components/EventSpecialDetailClient";

const getSpecialEvent = cache(async (id: string) => {
  const supabase = createClient();
  const { data } = await supabase.from("special_events").select("*").eq("id", id).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const event = await getSpecialEvent(params.id);
  if (!event || event.is_hidden) return {};
  return { title: event.title, description: event.description ?? undefined };
}

export default async function EventSpecialDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [event, profile] = await Promise.all([getSpecialEvent(params.id), getCurrentProfile()]);
  if (!event) {
    return <div className="text-muted text-center py-10">이벤트를 찾을 수 없습니다(삭제되었거나 숨김 처리됐을 수 있습니다).</div>;
  }

  // 대의원이면 본인 directory_members 기록(학년+반)을 미리 서버에서 구해 클라이언트로
  // 넘긴다 — is_representative_for() RLS 함수와 같은 사실을 화면에도 그대로 반영.
  let myClass: { grade: string; homeroom: number } | null = null;
  if (profile?.is_representative) {
    const { data: dm } = await supabase
      .from("directory_members")
      .select("grade, homeroom")
      .eq("email", profile.email)
      .eq("member_type", "student")
      .maybeSingle();
    if (dm?.grade && dm?.homeroom) myClass = { grade: dm.grade, homeroom: dm.homeroom };
  }

  return (
    <div>
      <DetailBackLink href="/events-special" label="이벤트 목록으로" />
      <EventSpecialDetailClient event={event} myId={profile?.id ?? null} myClass={myClass} />
    </div>
  );
}
