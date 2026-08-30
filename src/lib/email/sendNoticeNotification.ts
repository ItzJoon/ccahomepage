import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getTransporter } from "./transporter";
import type { Post } from "@/lib/types";

const FROM_NAME = "학생자치회";
const MAX_ATTEMPTS = 3; // 최초 시도 + 재시도 2회

function snippet(text: string, len = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > len ? `${clean.slice(0, len)}…` : clean;
}

function postUrl(post: Pick<Post, "id" | "type">) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  const path = post.type === "news" ? `/news/${post.id}` : `/notices/${post.id}`;
  return `${base}${path}`;
}

function buildHtml(post: Post) {
  const url = postUrl(post);
  const kindLabel = post.type === "news" ? "새 뉴스" : "새 공지사항";
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p style="color:#6B7280; font-size:13px; margin-bottom:4px;">${kindLabel}</p>
      <h2 style="margin:0 0 12px;">${post.title}</h2>
      <p style="color:#374151; line-height:1.6;">${snippet(post.content)}</p>
      <a href="${url}" style="display:inline-block; margin-top:16px; background:#16233F; color:#fff; text-decoration:none; padding:10px 18px; border-radius:8px; font-weight:bold;">
        자세히 보기
      </a>
    </div>
  `;
}

async function sendOne(to: string, post: Post): Promise<{ ok: true } | { ok: false; error: string }> {
  const transporter = getTransporter();
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await transporter.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to,
        subject: `[학생자치회] ${post.title}`,
        html: buildHtml(post),
      });
      return { ok: true };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return { ok: false, error: lastError instanceof Error ? lastError.message : String(lastError) };
}

/**
 * 공지/뉴스 새 글에 대한 이메일 알림을 대상자 전원에게 발송한다.
 * - notice/news: 이메일 알림을 켜둔 학생 전체
 * - subject_notice: student_subjects에 해당 과목이 있는 학생만
 * - homeroom_notice: directory_members.homeroom이 대상과 일치하는 학생만
 * 발송 결과(성공/실패)는 전부 email_notification_logs에 남긴다.
 */
export async function sendNoticeNotification(postId: string) {
  const supabase = createServiceRoleClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) return { sent: 0, failed: 0, skipped: "post-not-found" as const };

  let recipientEmails: string[] = [];

  if (post.type === "notice" || post.type === "news") {
    const { data } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "student")
      .eq("email_notifications", true);
    recipientEmails = (data ?? []).map((p) => p.email);
  } else if (post.type === "subject_notice" && post.target_subject) {
    const { data } = await supabase
      .from("student_subjects")
      .select("user_id, profiles!inner(email, role, email_notifications)")
      .eq("subject", post.target_subject);
    recipientEmails = (data ?? [])
      .filter((r: any) => r.profiles?.role === "student" && r.profiles?.email_notifications)
      .map((r: any) => r.profiles.email as string);
  } else if (post.type === "homeroom_notice" && post.target_homeroom) {
    const { data: members } = await supabase
      .from("directory_members")
      .select("email")
      .eq("homeroom", post.target_homeroom);
    const emails = (members ?? []).map((m) => m.email);
    if (emails.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "student")
        .eq("email_notifications", true)
        .in("email", emails);
      recipientEmails = (profiles ?? []).map((p) => p.email);
    }
  } else {
    return { sent: 0, failed: 0, skipped: "unsupported-type" as const };
  }

  recipientEmails = Array.from(new Set(recipientEmails.filter(Boolean)));

  let sent = 0;
  let failed = 0;
  const logs: {
    post_id: string;
    post_title: string;
    recipient_email: string;
    status: "sent" | "failed";
    error_message: string | null;
  }[] = [];

  for (const email of recipientEmails) {
    const result = await sendOne(email, post as Post);
    if (result.ok) {
      sent++;
      logs.push({ post_id: post.id, post_title: post.title, recipient_email: email, status: "sent", error_message: null });
    } else {
      failed++;
      logs.push({ post_id: post.id, post_title: post.title, recipient_email: email, status: "failed", error_message: result.error });
    }
  }

  if (logs.length > 0) {
    await supabase.from("email_notification_logs").insert(logs);
  }

  return { sent, failed, total: recipientEmails.length };
}
