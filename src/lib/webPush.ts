import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// VAPID 키가 아직 설정 안 된 로컬/미리보기 환경에서도 나머지 기능(알림 발송 자체)이
// 죽지 않도록, 여기서 한 번만 설정하고 값이 없으면 sendPushToAll이 조용히 건너뛴다.
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const isConfigured = !!publicKey && !!privateKey;
if (isConfigured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * 등록된 모든 구독자에게 웹 푸시를 보낸다(RLS를 우회해야 남의 구독 정보를 읽을 수 있어서
 * 서비스 롤 클라이언트를 쓴다 — 이메일 발송과 동일한 패턴). 구독이 만료/취소된 기기는
 * 410(Gone)/404를 돌려주는데, 그 상태로 계속 남아있으면 다음 발송마다 똑같이 실패하며
 * 시간을 낭비하므로 그 자리에서 바로 지운다.
 *
 * @returns 성공/실패 건수(둘 다 0이면 애초에 구독자가 없거나 VAPID 키 미설정).
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isConfigured) {
    console.warn("[webPush] VAPID 키가 설정되지 않아 푸시 발송을 건너뜁니다.");
    return { sent: 0, failed: 0, skipped: true };
  }

  const supabase = createServiceRoleClient();
  const { data: subscriptions } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (!subscriptions || subscriptions.length === 0) return { sent: 0, failed: 0, skipped: false };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          deadIds.push(sub.id);
        } else {
          console.error("[webPush] 발송 실패:", err?.statusCode, err?.body || err?.message);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", deadIds);
  }

  return { sent, failed, skipped: false };
}
