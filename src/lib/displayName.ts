/**
 * 관리자 화면에서 사람 이름을 표시할 때 공통으로 쓰는 형식. 닉네임과 실명이 둘 다 있으면
 * "닉네임(실명)"으로 함께 보여주고(관리자가 누구인지 바로 알아볼 수 있게), 하나만 있으면
 * 그것만, 둘 다 없으면 이메일이나 지정한 기본값을 보여준다.
 *
 * 데이터를 새로 저장하는 값(예: 부서 구성원 이름 초기값)으로는 쓰지 않는다 — 이건 어디까지나
 * "지금 화면에 표시할 문자열"이라, 여기 결과를 저장하면 "닉네임(실명)"이 그대로 영구
 * 데이터가 돼버린다(AccountPicker의 accountDisplayName은 그런 이유로 별개로 남겨뒀다).
 */
export function adminDisplayName(
  person: { nickname?: string | null; name?: string | null; email?: string | null } | null | undefined,
  fallback = "-"
): string {
  if (!person) return fallback;
  const { nickname, name, email } = person;
  if (nickname && name) return `${nickname}(${name})`;
  return nickname || name || email || fallback;
}
