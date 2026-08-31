// superadmin 역할의 실제 값(DB/RLS/미들웨어 판단 기준)은 그대로 "superadmin"을 쓰지만,
// 화면에 보여줄 때만 "developer"라는 이름으로 표시한다(권한 로직은 전혀 바뀌지 않음).
export function roleLabel(role: string): string {
  return role === "superadmin" ? "developer" : role;
}
