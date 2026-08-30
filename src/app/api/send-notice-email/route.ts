import { NextRequest, NextResponse } from "next/server";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { previewNoticeAudience, sendNoticeToAudience } from "@/lib/email/sendNoticeNotification";
import type { EmailAudience } from "@/lib/types";

// nodemailer는 Node.js API(net/tls)를 쓰므로 Edge 런타임에서 돌릴 수 없다.
export const runtime = "nodejs";
// 대상자 수가 많으면 순차 발송에 시간이 걸릴 수 있어 Vercel 기본 제한보다 넉넉하게 잡는다.
// 학교 규모가 훨씬 커지면 이 방식 대신 큐 기반 발송으로 바꿔야 할 수 있다.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { postId, audience, dryRun } = body as { postId?: string; audience?: EmailAudience; dryRun?: boolean };
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId가 필요합니다." }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile || !["teacher", "editor", "admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const supabase = createClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }
  if (post.status !== "published") {
    return NextResponse.json({ error: "발행된 글만 이메일로 보낼 수 있습니다." }, { status: 400 });
  }

  // teacher는 본인이 쓴 교과/학급 공지만 발송할 수 있다(글쓰기 권한과 동일한 경계).
  if (profile.role === "teacher") {
    if (post.type !== "subject_notice" && post.type !== "homeroom_notice") {
      return NextResponse.json({ error: "teacher는 교과/학급 공지만 발송할 수 있습니다." }, { status: 403 });
    }
    if (post.author_id !== profile.id) {
      return NextResponse.json({ error: "본인이 작성한 공지만 발송할 수 있습니다." }, { status: 403 });
    }
  }

  // 일반 공지/뉴스에서 "전체 학생/교사" 발송은 admin 이상만 할 수 있다. subject_notice/
  // homeroom_notice는 항상 자동 대상(auto)이라 이 제한과 무관하다.
  if (
    (post.type === "notice" || post.type === "news") &&
    audience?.mode === "all" &&
    !["admin", "superadmin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "전체 발송은 admin 이상만 할 수 있습니다." }, { status: 403 });
  }

  const effectiveAudience: EmailAudience =
    post.type === "subject_notice" || post.type === "homeroom_notice" ? { mode: "auto" } : audience ?? { mode: "all" };

  try {
    if (dryRun) {
      const result = await previewNoticeAudience(postId, effectiveAudience);
      if (!result) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({
        count: result.emails.length,
        emails: result.emails.slice(0, 50),
        description: result.description,
        todaySentCount: result.todaySentCount,
      });
    }
    const result = await sendNoticeToAudience(postId, effectiveAudience, profile.id);
    if (!result) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "이메일 발송 중 오류가 발생했습니다." }, { status: 500 });
  }
}
