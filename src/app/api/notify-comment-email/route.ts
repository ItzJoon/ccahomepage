import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTransporter } from "@/lib/email/transporter";

// nodemailer는 Node.js API(net/tls)를 쓰므로 Edge 런타임에서 돌릴 수 없다(send-notice-email과 동일한 이유).
export const runtime = "nodejs";

const FROM_NAME = "학생자치회";

/**
 * 공지 댓글이 새로 달리면 알림 센터 알림은 DB 트리거(notify_notice_comment)가 이미
 * 처리하지만, 이메일 발송은 트리거(순수 SQL)로 할 수 없어서 댓글 등록 직후 클라이언트가
 * 이 라우트를 한 번 호출한다. 이메일 발송 실패는 댓글 자체의 성공/실패와 무관하게
 * 조용히 무시된다(웹 푸시 발송과 동일한 방침) — 클라이언트에서 .catch(() => {})로 던진다.
 *
 * 클라이언트가 넘긴 값을 그대로 믿지 않고, commentId로 실제 댓글/공지/작성자를 서버에서
 * 다시 조회해 이메일 내용을 직접 구성한다(임의의 이메일 주소나 문구를 넣어 보낼 수 없게).
 */
export async function POST(req: NextRequest) {
  const { commentId } = (await req.json()) as { commentId?: string };
  if (!commentId || typeof commentId !== "string") {
    return NextResponse.json({ error: "commentId가 필요합니다." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: comment } = await supabase
    .from("notice_comments")
    .select("*, author_name")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) {
    return NextResponse.json({ ok: false, reason: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  // 이미 오래전에 등록된 댓글 id로 반복 호출해서 옛 댓글에 대한 메일을 다시 보내게 하는
  // 것을 막는다 — 정상적인 흐름(댓글 등록 직후 자동 호출)이라면 항상 몇 초 이내다.
  if (Date.now() - new Date(comment.created_at).getTime() > 2 * 60 * 1000) {
    return NextResponse.json({ ok: false, reason: "너무 오래된 댓글입니다." }, { status: 400 });
  }

  const { data: post } = await supabase.from("posts").select("id, title, author_id").eq("id", comment.post_id).maybeSingle();
  if (!post || !post.author_id || post.author_id === comment.author_id) {
    // 원 작성자가 없거나(미가입 명단 글 등) 본인이 자기 글에 단 댓글이면 메일을 보낼
    // 이유가 없다.
    return NextResponse.json({ ok: true, sent: false });
  }

  // 댓글 작성자(대부분 일반 학생) 세션으로는 profiles RLS에 막혀 공지 작성자의 프로필을
  // 직접 조회할 수 없으므로, email/email_notifications만 좁게 내려주는 RPC를 쓴다.
  const { data: authorPrefRows } = await supabase.rpc("get_email_pref_for_user", { p_user_id: post.author_id });
  const authorProfile = authorPrefRows?.[0];
  if (!authorProfile?.email || authorProfile.email_notifications === false) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const commenterName = (comment.author_name as string | null) || "누군가";

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
      to: authorProfile.email,
      subject: `[학생자치회] ${commenterName}님이 "${post.title}"에 댓글을 남겼어요`,
      html: `
        <p>${commenterName}님이 회원님의 공지 "<strong>${post.title}</strong>"에 댓글을 남겼어요.</p>
        <p style="color:#666;white-space:pre-wrap;">${comment.content}</p>
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/notices/${post.id}">공지 보러 가기</a></p>
      `,
    });
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "발송 실패" }, { status: 500 });
  }
}
