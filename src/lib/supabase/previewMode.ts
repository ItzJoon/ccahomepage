/**
 * "지금 이 탭이 학생 화면 미리보기 세션인가"를 동기적으로 판단하기 위한 플래그.
 * sessionStorage를 쓰는 이유: (1) 브라우저 탭/창이 닫히면 자동으로 사라져서 미리보기
 * 상태가 실수로 남지 않고, (2) client.ts의 쓰기 차단 Proxy가 매 insert/update/delete
 * 호출마다 "지금 미리보기 중인가"를 세션을 다시 조회하지 않고 즉시(동기) 확인해야 하기
 * 때문이다(Supabase의 auth.getSession()은 비동기라 Proxy의 get 핸들러 안에서 쓸 수 없다).
 */
const FLAG_KEY = "cca_preview_mode_active";

export function isPreviewModeActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPreviewModeActive(active: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (active) sessionStorage.setItem(FLAG_KEY, "1");
    else sessionStorage.removeItem(FLAG_KEY);
  } catch {
    // 프라이빗 브라우징 등으로 sessionStorage를 못 쓰면 미리보기 자체는 계속 되지만
    // 쓰기 차단만 동작하지 않을 수 있다 — 드문 경우라 별도 안내는 생략.
  }
}
