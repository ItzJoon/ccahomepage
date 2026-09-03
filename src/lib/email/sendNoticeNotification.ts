import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getTransporter } from "./transporter";
import type { EmailAudience, Post, PostType } from "@/lib/types";

const FROM_NAME = "학생자치회";
const MAX_ATTEMPTS = 3; // 최초 시도 + 재시도 2회
const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };
// 수신자마다 sendMail을 따로 호출하지 않고 BCC로 한 번에 묶어 보낸다 — 청크 크기는
// Gmail 공식 한도(메일 1통당 수신자 to+cc+bcc 합쳐 최대 500명)보다 충분히 낮게 잡았다.
// 개인 Gmail 계정(Workspace 아님)은 대량 BCC를 스팸으로 더 쉽게 분류하고, 청크 하나가
// 늘어날수록 그 안에 한 명이라도 문제(존재하지 않는 주소 등)가 있을 때 전체 청크의
// 성공/실패 판정에 영향을 주는 범위도 커지므로, 500의 여유 있는 부분집합인 90으로 뒀다.
const BCC_CHUNK_SIZE = 90;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 대상 계산에는 글의 type/target_subject/target_homeroom만 있으면 되고 제목·본문은 필요
// 없다 — 그 덕분에 아직 저장 전인 글(작성 화면에서 "게시하기" 누르기 전 미리보기)도 같은
// 로직으로 대상자 수를 계산할 수 있다.
interface AudienceCriteria {
  type: PostType;
  target_subject: string | null;
  target_homeroom: number | null;
}

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
  criteria: AudienceCriteria,
  audience: EmailAudience
): Promise<{ emails: string[]; description: string }> {
  const filterOptOut = async (emails: string[]) => {
    if (emails.length === 0) return emails;
    const { data } = await supabase.from("profiles").select("email, email_notifications").in("email", emails);
    const optedOut = new Set((data ?? []).filter((p) => p.email_notifications === false).map((p) => p.email));
    return emails.filter((e) => !optedOut.has(e));
  };

  if (criteria.type === "subject_notice" && criteria.target_subject) {
    const { data } = await supabase
      .from("student_subjects")
      .select("user_id, profiles!inner(email)")
      .eq("subject", criteria.target_subject);
    const emails = Array.from(new Set((data ?? []).map((r: any) => r.profiles?.email as string).filter(Boolean)));
    return { emails: await filterOptOut(emails), description: `교과 공지 자동 대상 (${criteria.target_subject})` };
  }

  if (criteria.type === "homeroom_notice" && criteria.target_homeroom) {
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .eq("member_type", "student")
      .eq("homeroom", criteria.target_homeroom)
      .eq("is_allowed", true);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    const label = HOMEROOM_LABEL[criteria.target_homeroom] ?? `${criteria.target_homeroom}`;
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
    if (audience.classes.length === 0) return { emails: [], description: "선택된 학급 없음" };
    // homeroom(반 번호)만으로는 학년이 겹쳐서(10/11/12학년 모두 1~3반이 있음) 특정 학급을
    // 가리킬 수 없다 — 반드시 학년+반을 함께 매칭해야 한다(예: 10학년 2반).
    const orFilter = audience.classes.map((c) => `and(grade.eq.${c.grade},homeroom.eq.${c.homeroom})`).join(",");
    const { data } = await supabase
      .from("directory_members")
      .select("email")
      .eq("member_type", "student")
      .eq("is_allowed", true)
      .or(orFilter);
    const emails = Array.from(new Set((data ?? []).map((m) => m.email)));
    const labels = audience.classes
      .map((c) => `${c.grade}학년 ${HOMEROOM_LABEL[c.homeroom] ?? `${c.homeroom}반`}`)
      .join(", ");
    return { emails: await filterOptOut(emails), description: labels };
  }

  if (audience.mode === "custom") {
    const emails = Array.from(new Set(audience.emails.map((e) => e.trim()).filter((e) => e.includes("@"))));
    return { emails, description: "직접 입력한 이메일 주소" };
  }

  return { emails: [], description: "대상 없음" };
}

/**
 * 수신자 한 묶음(최대 BCC_CHUNK_SIZE명)을 BCC로 한 번에 보낸다. SMTP 응답의
 * accepted/rejected 목록을 그대로 돌려줘서, 호출부가 수신자별 성공/실패 로그를
 * 기존과 동일한 세밀함으로 남길 수 있게 한다(반복 발송에서 BCC로 바꿔도 "누구에게
 * 실패했는지"는 그대로 알 수 있어야 하므로).
 */
async function sendChunk(
  bccList: string[],
  post: Post
): Promise<{ accepted: string[]; rejected: string[]; error?: string }> {
  const transporter = getTransporter();
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        bcc: bccList.join(","),
        subject: `[학생자치회] ${post.title}`,
        html: buildHtml(post),
      });
      return {
        accepted: (info.accepted ?? []).map(String),
        rejected: (info.rejected ?? []).map(String),
      };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  // 청크 전체가 실패한 경우(연결 오류 등) — 이 묶음의 모든 수신자를 실패로 기록한다.
  return { accepted: [], rejected: bccList, error: lastError instanceof Error ? lastError.message : String(lastError) };
}

async function todaySentCount(supabase: ReturnType<typeof createServiceRoleClient>) {
  // Gmail 무료 계정 일일 발송 한도(약 500통) 참고용으로, 오늘(KST) 이미 시도한 발송 건수를
  // 함께 보여준다 — 정확한 차단이 아니라 사전 경고 목적이다.
  const todayStartUtc = new Date();
  todayStartUtc.setUTCHours(todayStartUtc.getUTCHours() - 9, 0, 0, 0); // KST 00:00 -> UTC
  const { count } = await supabase
    .from("email_notification_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStartUtc.toISOString());
  return count ?? 0;
}

/** 실제 발송 없이 대상자 수/목록/문구만 미리 계산한다(발송 전 확인 화면용, 이미 저장된 글). */
export async function previewNoticeAudience(postId: string, audience: EmailAudience) {
  const supabase = createServiceRoleClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) return null;
  const { emails, description } = await resolveAudience(supabase, post as Post, audience);
  return { post, emails, description, todaySentCount: await todaySentCount(supabase) };
}

/**
 * 아직 저장되지 않은 글(작성 화면에서 "게시하기" 누르기 전)에 대한 대상자 미리보기.
 * type/target_subject/target_homeroom만으로 계산하므로 postId가 필요 없다.
 */
export async function previewAudienceByCriteria(criteria: AudienceCriteria, audience: EmailAudience) {
  const supabase = createServiceRoleClient();
  const { emails, description } = await resolveAudience(supabase, criteria, audience);
  return { emails, description, todaySentCount: await todaySentCount(supabase) };
}

/**
 * 대상자에게 실제로 발송하고, 발송 이력(batch)과 수신자별 성공/실패 로그를 남긴다.
 */
export async function sendNoticeToAudience(postId: string, audience: EmailAudience, sentBy: string) {
  const supabase = createServiceRoleClient();
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) return null;
  const { emails, description } = await resolveAudience(
    supabase,
    { type: post.type, target_subject: post.target_subject, target_homeroom: post.target_homeroom },
    audience
  );

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

  // 대상자가 0명이면 굳이 SMTP 요청을 만들지 않고 건너뛴다 — 빈 bcc로 발송을 시도해도
  // 의미가 없고, 배치 이력은 이미 recipient_count:0으로 남아있으니 그대로 0/0으로 마감한다.
  if (emails.length > 0) {
    for (const group of chunk(emails, BCC_CHUNK_SIZE)) {
      const result = await sendChunk(group, post as Post);
      if (result.error) {
        failed += group.length;
        for (const email of group) {
          logs.push({ post_id: post.id, post_title: post.title, batch_id: batch.id, recipient_email: email, status: "failed", error_message: result.error });
        }
        continue;
      }
      for (const email of result.accepted) {
        sent++;
        logs.push({ post_id: post.id, post_title: post.title, batch_id: batch.id, recipient_email: email, status: "sent", error_message: null });
      }
      for (const email of result.rejected) {
        failed++;
        logs.push({ post_id: post.id, post_title: post.title, batch_id: batch.id, recipient_email: email, status: "failed", error_message: "수신 거부됨(주소 오류 등)" });
      }
    }
  }

  if (logs.length > 0) {
    await supabase.from("email_notification_logs").insert(logs);
  }
  await supabase.from("email_notification_batches").update({ success_count: sent, failure_count: failed }).eq("id", batch.id);

  return { sent, failed, total: emails.length, batchId: batch.id, description };
}
