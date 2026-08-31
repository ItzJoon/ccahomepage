// designer(조회 전용) 계정이 superadmin 전용 화면(회원·권한 관리/외부 계정 관리/접속
// 통계/활동 로그)에 들어갔을 때, 화면 구조는 그대로 보여주되 실제 학생/교사 이름·이메일
// 같은 개인정보는 절대 노출하지 않기 위한 가짜 데이터 생성기. 같은 seed(주로 사용자 id)에는
// 항상 같은 값을 돌려줘서, 새로고침하거나 여러 화면을 오가도 같은 사람이 계속 같은 가짜
// 이름으로 보인다(매번 랜덤이면 버그처럼 보임).
const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"];
const GIVEN_NAMES = [
  "민준", "서연", "도윤", "하은", "시우", "지우", "주원", "서윤", "예준", "수아",
  "은우", "다인", "지호", "하윤", "현우", "소율", "다은", "유준", "채원", "건우",
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function fakeName(seed: string): string {
  const h = hashSeed(seed);
  const surname = SURNAMES[h % SURNAMES.length];
  const given = GIVEN_NAMES[Math.floor(h / SURNAMES.length) % GIVEN_NAMES.length];
  return `${surname}${given}`;
}

export function fakeEmail(seed: string): string {
  const h = hashSeed(`${seed}:email`);
  return `user${h % 100000}@example.com`;
}

/** 자유 텍스트(경고/차단 사유, 신고 내용 등)는 이름으로 흉내낼 수 없으니 통째로 가림. */
export function fakeText(): string {
  return "(가상 데이터 — 실제 내용은 표시되지 않습니다)";
}
