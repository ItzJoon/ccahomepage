/** notifications row 하나가 지금 로그인한 사용자(myEmail)에게 보여야 하는지 판단한다.
 * audience_emails가 null이면 전체 공개(항상 보임). 서버(( site)/layout.tsx의 초기 조회)와
 * 클라이언트(NotificationBanner/NotificationPopup의 realtime INSERT 핸들러) 양쪽에서
 * 똑같은 기준으로 판단해야 하므로, 이 순수 함수 하나를 그대로 공유한다 — supabase
 * import가 전혀 없어 서버/클라이언트 어디서 가져다 써도 안전하다. */
export function notificationTargetsMe(audienceEmails: string[] | null, myEmail: string | null | undefined) {
  if (audienceEmails === null) return true;
  if (!myEmail) return false;
  return audienceEmails.includes(myEmail);
}
