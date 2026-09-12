import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/webPush";

// web-push는 Node.js API를 쓰므로 Edge 런타임에서 돌릴 수 없다(이메일 발송과 동일한 이유).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // notifications 테이블 자체의 쓰기 권한(is_editor_or_above)과 동일한 기준으로 맞춘다.
  const profile = await getCurrentProfile();
  if (!profile || !["editor", "admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const { title, message, url } = body as { title?: string; message?: string; url?: string };
  if (!title?.trim()) {
    return NextResponse.json({ error: "제목이 필요합니다." }, { status: 400 });
  }

  const result = await sendPushToAll({ title, body: message || "", url });
  return NextResponse.json(result);
}
