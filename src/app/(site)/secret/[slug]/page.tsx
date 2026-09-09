import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 활성 창(요일/시각) 여부가 매 요청마다 실제 현재 시각 기준으로 판단돼야 하므로 캐싱하지
// 않는다 — 다른 시간대 관련 페이지((site)/layout.tsx, (site)/page.tsx)와 동일하게
// force-dynamic.
export const dynamic = "force-dynamic";

/**
 * "시간대 한정 숨은 페이지형" 시크릿 뱃지 전용 페이지. 평소에는 존재하지 않는 것처럼
 * 동작해야 하므로, 뱃지 자체가 없거나 지금이 활성 시간대가 아니면 notFound()로 404를
 * 낸다(직접 URL 접속도 동일). 활성 시간대에 실제로 들어오면 방문 자체로 지급된다 —
 * claim_secret_trigger_badge가 서버에서 다시 한 번 활성 여부를 검증하므로, 이 페이지가
 * 잠깐이라도 열려 있었다고 해서 시간이 지난 뒤에도 지급이 되는 일은 없다.
 */
export default async function SecretTimedPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: badge } = await supabase
    .from("badges")
    .select("id, label, trigger_config")
    .eq("trigger_type", "timed_page")
    .eq("is_active", true)
    .eq("trigger_config->>slug", params.slug)
    .maybeSingle();

  if (!badge) notFound();

  const { data: isActive } = await supabase.rpc("is_timed_secret_badge_active", { p_badge_id: badge.id });
  if (!isActive) notFound();

  await supabase.rpc("claim_secret_trigger_badge", { p_badge_id: badge.id });

  const cfg = badge.trigger_config as { content_text: string; image_url?: string };

  return (
    <div className="bg-surface border border-border rounded-2xl p-7 text-center">
      {cfg.image_url && (
        <img src={cfg.image_url} alt="" className="mx-auto mb-4 max-h-48 rounded-lg object-contain" />
      )}
      <p className="text-lg font-bold whitespace-pre-line">{cfg.content_text}</p>
    </div>
  );
}
