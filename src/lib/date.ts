// new Date().toISOString()는 항상 UTC 기준 날짜라서, 한국 시간 자정~오전 9시 사이에는
// 실제로는 "오늘"인데도 어제 날짜로 계산되는 버그가 여러 곳에서 반복 발생했다(예: 한국시간
// 8/29 08:00 = UTC 8/28 23:00, slice(0,10)이 "8/28"을 반환). 한국 시간대(Asia/Seoul) 기준
// 날짜/자정 계산을 한 곳에 모아두고 "오늘"이 필요한 모든 곳에서 이걸 쓴다.

/** 한국 시간(Asia/Seoul) 기준 오늘 날짜 문자열(YYYY-MM-DD). */
export function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** "YYYY-MM-DD" 문자열에 일수를 더하고(음수면 뺀 뒤) 다시 "YYYY-MM-DD"로 돌려준다. */
export function addDaysKST(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/**
 * timestamptz(예: org_events.start_at)를 한국 시간(Asia/Seoul) 기준 YYYY-MM-DD로 변환한다.
 * 브라우저 로컬 타임존에 의존하면 방문자 기기 설정에 따라 날짜가 하루 밀릴 수 있어(위
 * todayKST 주석과 같은 문제), 달력에 날짜별로 묶어 보여줘야 하는 곳에서는 이걸 쓴다.
 */
export function toKSTDateString(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
}

// 한국은 서머타임이 없어 UTC+9 고정이라, locale 문자열을 왕복 파싱하는 것보다
// 오프셋을 직접 더하고 빼는 편이 더 정확하고 서버/브라우저의 로컬 타임존과도 무관하다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 지금부터 한국 시간 기준 다음 자정까지 남은 초. "오늘 하루" 단위로 리셋되는 쿠키 등의
 * 만료 시간을 정할 때 쓴다 — 조회 시점으로부터의 고정된 24시간이 아니라, 실제 달력상
 * 자정이 지나면 리셋되게 하기 위함이다.
 */
export function secondsUntilNextMidnightKST(): number {
  const now = new Date();
  const kstShifted = new Date(now.getTime() + KST_OFFSET_MS);
  const nextMidnightShiftedUTC = Date.UTC(
    kstShifted.getUTCFullYear(),
    kstShifted.getUTCMonth(),
    kstShifted.getUTCDate() + 1
  );
  const nextMidnightRealUTC = nextMidnightShiftedUTC - KST_OFFSET_MS;
  return Math.max(1, Math.round((nextMidnightRealUTC - now.getTime()) / 1000));
}

/** "방금 전"/"3시간 전"/"어제"/"5일 전" 같은 상대 시간 문구(관리자 대시보드 최근 활동용). */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  return `${days}일 전`;
}
