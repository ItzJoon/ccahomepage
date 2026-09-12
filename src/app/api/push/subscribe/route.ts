import { NextRequest, NextResponse } from "next/server";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, keys } = body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "잘못된 구독 정보입니다." }, { status: 400 });
  }

  const supabase = createClient();
  // endpoint가 unique라서, 같은 기기가 다시 구독해도(예: 알림 권한을 껐다 켠 경우)
  // 새 행이 쌓이지 않고 upsert로 덮어써진다.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: profile.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: "endpoint" }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
