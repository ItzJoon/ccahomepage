import { NextRequest, NextResponse } from "next/server";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { previewAudienceByCriteria, previewNoticeAudience, sendNoticeToAudience } from "@/lib/email/sendNoticeNotification";
import type { EmailAudience, PostType } from "@/lib/types";

// nodemailer는 Node.js API(net/tls)를 쓰므로 Edge 런타임에서 돌릴 수 없다.
export const runtime = "nodejs";
// 대상자 수가 많으면 순차 발송에 시간이 걸릴 수 있어 Vercel 기본 제한보다 넉넉하게 잡는다.
// 학교 규모가 훨씬 커지면 이 방식 대신 큐 기반 발송으로 바꿔야 할 수 있다.
export const maxDuration = 300;

interface Criteria {
  type: PostType;
  target_subject: string | null;
  target_homeroom: number | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { postId, criteria, audience, dryRun } = body as {
    postId?: string;
    criteria?: Criteria;
    audience?: EmailAudience;
    dryRun?: boolean;
  };

  // teacher는 student와 동일하게 이메일 발송 권한이 없다(아래 profile.role === "teacher"
  // 분기는 예전 teacher 전용 검증 로직인데, 이 게이트를 통과 못 하므로 더 이상 실행되지
  // 않는다 — teacher 권한을 되살릴 일이 생기면 여기 목록에 "teacher"만 다시 추가하면 됨).
  const profile = await getCurrentProfile();
  if (!profile || !["editor", "admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // "게시하기" 버튼 누르기 전, 아직 저장되지 않은 글에 대한 대상자 미리보기 — postId가
  // 없고 criteria만 있을 때다. 실제 발송(dryRun=false)은 글이 실제로 존재해야 하므로
  // 이 경로에서는 지원하지 않는다.
  if (!postId && criteria) {
    if (!dryRun) {
      return NextResponse.json({ error: "저장되지 않은 글은 미리보기만 가능합니다." }, { status: 400 });
    }
    if (profile.role === "teacher") {
      if (criteria.type !== "subject_notice" && criteria.type !== "homeroom_notice") {
        return NextResponse.json({ error: "teacher는 교과/학급 공지만 발송할 수 있습니다." }, { status: 403 });
      }
      // 본인이 실제로 담당하는 과목/학급인지 서버에서 다시 확인한다(RLS의
      // teacher_owns_subject/teacher_owns_homeroom과 동일한 검증을 클라이언트가
      // 아직 저장하지 않은 값에 대해서도 우회할 수 없게).
      const supabase = createClient();
      const { data: dm } = await supabase
        .from("directory_members")
        .select("subject, homeroom")
        .eq("email", profile.email)
        .maybeSingle();
      if (criteria.type === "subject_notice") {
        const subjects = ((dm?.subject as string | null) ?? "").split(",").map((s) => s.trim());
        if (!criteria.target_subject || !subjects.includes(criteria.target_subject)) {
          return NextResponse.json({ error: "본인이 담당하는 과목이 아닙니다." }, { status: 403 });
        }
      } else if (criteria.type === "homeroom_notice") {
        if (!criteria.target_homeroom || dm?.homeroom !== criteria.target_homeroom) {
          return NextResponse.json({ error: "본인이 담당하는 학급이 아닙니다." }, { status: 403 });
        }
      }
    }
    if (
      (criteria.type === "notice" || criteria.type === "news") &&
      audience?.mode === "all" &&
      !["admin", "superadmin"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "전체 발송은 admin 이상만 할 수 있습니다." }, { status: 403 });
    }
    const effectiveAudience: EmailAudience =
      criteria.type === "subject_notice" || criteria.type === "homeroom_notice" ? { mode: "auto" } : audience ?? { mode: "all" };
    try {
      const result = await previewAudienceByCriteria(criteria, effectiveAudience);
      return NextResponse.json({
        count: result.emails.length,
        emails: result.emails.slice(0, 50),
        description: result.description,
        todaySentCount: result.todaySentCount,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "대상자 계산 중 오류가 발생했습니다." }, { status: 500 });
    }
  }

  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId가 필요합니다." }, { status: 400 });
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
