import { NextRequest, NextResponse } from "next/server";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { sendNoticeNotification } from "@/lib/email/sendNoticeNotification";

// nodemailer는 Node.js API(net/tls)를 쓰므로 Edge 런타임에서 돌릴 수 없다.
export const runtime = "nodejs";
// 수백 명에게 순차 발송하면 시간이 걸릴 수 있어 Vercel 기본 제한(보통 몇 초~수십 초)보다
// 넉넉하게 잡는다. 플랜에 따라 허용되는 최대값이 다르므로, 학교 규모가 훨씬 커지면
// 이 방식(요청-응답 안에서 전부 처리) 대신 큐 기반 발송으로 바꿔야 할 수 있다.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { postId } = await req.json();
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId가 필요합니다." }, { status: 400 });
  }

  // 공지 작성 권한이 있는 역할만 이 API를 트리거할 수 있게 한다(실제 대상자 계산은
  // 서비스 롤로 하지만, 아무나 이 엔드포인트를 두드려서 전체 학생에게 메일을 보내게
  // 하면 안 되므로 별도로 확인한다).
  const profile = await getCurrentProfile();
  if (!profile || !["teacher", "editor", "admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 이 글이 실제로 존재하고 발행 상태인지도 확인한다(RLS 그대로 통과하는 조회).
  const supabase = createClient();
  const { data: post } = await supabase.from("posts").select("id, status").eq("id", postId).single();
  if (!post || post.status !== "published") {
    return NextResponse.json({ error: "발행된 글이 아닙니다." }, { status: 404 });
  }

  try {
    const result = await sendNoticeNotification(postId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "이메일 발송 중 오류가 발생했습니다." }, { status: 500 });
  }
}
