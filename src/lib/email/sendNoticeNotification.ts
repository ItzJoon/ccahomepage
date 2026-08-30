import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getTransporter } from "./transporter";
import type { EmailAudience, Post } from "@/lib/types";

const FROM_NAME = "학생자치회";
const MAX_ATTEMPTS = 3; // 최초 시도 + 재시도 2회
const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };

function snippet(text: string, len = 200) {
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

/**
 * 선택된 대상 조건(전체/학년/학급/직접입력/자동)에 맞는 실제 수신자 이메일 목록을 계산한다.
 * - all/grades/homerooms: directory_members에서 조건에 맞는 이메일을 뽑는다(학교 명단이
 *   실제 학년/학급 정보를 갖고 있는 곳).
 * - auto(교과/학급 공지): 교과는 student_subjects(수강 등록), 학급은 directory_members.homeroom
 *   기준으로 기존 RLS와 동일한 로직을 재사용한다.
 * - custom: 관리자가 직접 입력한 주소를 그대로 쓴다(명단 조회를 거치지 않음).
 * all/grades/homerooms/auto로 뽑은 이메일은 profiles.email_notifications=false로 수신을
 * 꺼둔 학생을 제외한다(가입하지 않아 profiles가 없는 경우는 꺼둔 적이 없으니 그대로 포함).
 * custom은 관리자가 명시적으로 지정한 주소라 이 필터를 적용하지 않는다.
 */
async function resolveAudience(
  supabase: ReturnType<typeof createServiceRoleClient>,
  post: Post,
  audience: EmailAudience
): Promise<{ emails: string[]; description: string }> {
  const filterOptOut = async (emails: string[]) => {
    if (emails.length === 0) return emails;
    const { data } = await supabase.from("profiles").select("email, email_notifications").in("email", emails);
    const optedOut = new Set((data ?? []).filter((p) => p.email_notifications === false).map((p) => p.email));
    return emails.filter((e) => !optedOut.has(e));
  };

  if (post.type === "subject_notice" && post.target_subject) {
    const { data } = await supabase
      .from("student_subjects")
      .select("user_id, profiles!inner(email)")
      .eq("subject", post.target_subject);
    const emails = Array.from(new Set((data ?? []).map((r: any) => r.profiles?.email as string).filter(Boolean)));
    return { emails: await filterOptOut(emails), description: `교과 공지 자동 대상 (${post.target_subject})` };
  }

  if (post.type === "homeroom_notice" && post.target_homeroom) {
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .eq("member_type", "student")
      .eq("homeroom", post.target_homeroom)
      .eq("is_allowed", true);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    const label = HOMEROOM_LABEL[post.target_homeroom] ?? `${post.target_homeroom}`;
    return { emails: await filterOptOut(emails), description: `학급 공지 자동 대상 (${label})` };
  }

  if (audience.mode === "all") {
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .in("member_type", ["student", "teacher"])
      .eq("is_allowed", true);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    return { emails: await filterOptOut(emails), description: "전체 학생/교사" };
  }

  if (audience.mode === "grades") {
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .eq("member_type", "student")
      .eq("is_allowed", true)
      .in("grade", audience.grades);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    return { emails: await filterOptOut(emails), description: `${audience.grades.join(", ")}학년` };
  }

  if (audience.mode === "homerooms") {
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .eq("member_type", "student")
      .eq("is_allowed", true)
      .in("homeroom", audience.homerooms);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    const labels = audience.homerooms.map((h) => HOMEROOM_LABEL[h] ?? `${h}`).join(", ");
    return { emails: await filterOptOut(emails), description: `${labels}반` };
  }

  if (audience.mode === "custom") {
    const emails = Array.from(new Set(audience.emails.map((e) => e.trim()).filter((e) => e.includes("@"))));
    return { emails, description: "직접 입력한 이메일 주소" };
  }

  return { emails: [], description: "대상 없음" };
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

/** 실제 발송 없이 대상자 수/목록/문구만 미리 계산한다(발송 전 확인 화면용). */
export async function previewNoticeAudience(postId: string, audience: EmailAudience) {
  const supabase = createServiceRoleClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) return null;
  const { emails, description } = await resolveAudience(supabase, post as Post, audience);

  // Gmail 무료 계정 일일 발송 한도(약 500통) 참고용으로, 오늘(KST) 이미 시도한 발송 건수를
  // 함께 보여준다 — 정확한 차단이 아니라 사전 경고 목적이다.
  const todayStartUtc = new Date();
  todayStartUtc.setUTCHours(todayStartUtc.getUTCHours() - 9, 0, 0, 0); // KST 00:00 -> UTC
  const { count } = await supabase
    .from("email_notification_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStartUtc.toISOString());

  return { post, emails, description, todaySentCount: count ?? 0 };
}

/**
 * 대상자에게 실제로 발송하고, 발송 이력(batch)과 수신자별 성공/실패 로그를 남긴다.
 */
export async function sendNoticeToAudience(postId: string, audience: EmailAudience, sentBy: string) {
  const supabase = createServiceRoleClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) return null;
  const { emails, description } = await resolveAudience(supabase, post as Post, audience);

  const { data: batch, error: batchError } = await supabase
    .from("email_notification_batches")
    .insert({
      post_id: post.id,
      post_title: post.title,
      sent_by: sentBy,
      audience_description: description,
      recipient_count: emails.length,
    })
    .select()
    .single();
  if (batchError || !batch) throw new Error(batchError?.message ?? "발송 이력 생성에 실패했습니다.");

  let sent = 0;
  let failed = 0;
  const logs: {
    post_id: string;
    post_title: string;
    batch_id: string;
    recipient_email: string;
    status: "sent" | "failed";
    error_message: string | null;
  }[] = [];

  for (const email of emails) {
    const result = await sendOne(email, post as Post);
    if (result.ok) {
      sent++;
      logs.push({ post_id: post.id, post_title: post.title, batch_id: batch.id, recipient_email: email, status: "sent", error_message: null });
    } else {
      failed++;
      logs.push({ post_id: post.id, post_title: post.title, batch_id: batch.id, recipient_email: email, status: "failed", error_message: result.error });
    }
  }

  if (logs.length > 0) {
    await supabase.from("email_notification_logs").insert(logs);
  }
  await supabase.from("email_notification_batches").update({ success_count: sent, failure_count: failed }).eq("id", batch.id);

  return { sent, failed, total: emails.length, batchId: batch.id, description };
}
