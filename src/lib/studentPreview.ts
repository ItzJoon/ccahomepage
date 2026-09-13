"use client";

import { createClient } from "@/lib/supabase/client";
import { setPreviewModeActive } from "@/lib/supabase/previewMode";

// 미리보기로 전환하기 직전의 "진짜 개발자" 세션을 잠깐 넣어뒀다가, 미리보기를 끝낼 때
// 그대로 복원한다. sessionStorage를 쓰는 이유는 previewMode.ts와 동일(탭을 닫으면
// 자동으로 사라짐).
const STASH_KEY = "cca_preview_stashed_session";

/**
 * "학생 화면 보기" — 실제로 전용 미리보기 학생 계정(src/lib/previewStudent.ts)의 세션으로
 * 브라우저 탭 전체를 전환한다. 단순히 화면 표시만 바꾸는 게 아니라 진짜 세션을 바꾸는
 * 것이므로, 읽음 기록·알림 확인 여부·뱃지·연속 접속일수·마이페이지 정보가 전부 그
 * 계정 고유의(항상 비어있는) 진짜 데이터로 자동으로 맞춰진다 — 화면마다 "미리보기면
 * 이렇게 보여줘" 하는 예외 코드를 따로 추가할 필요가 없다.
 */
export async function startStudentPreview(): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { session: myRealSession },
  } = await supabase.auth.getSession();
  if (!myRealSession) return { ok: false, error: "로그인 정보를 확인할 수 없습니다." };

  const res = await fetch("/api/preview/session", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error || "미리보기 세션을 만들지 못했습니다." };
  }
  const { hashedToken } = (await res.json()) as { hashedToken: string };

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });
  if (verifyError || !verifyData.session) {
    return { ok: false, error: verifyError?.message || "미리보기 세션 전환에 실패했습니다." };
  }

  sessionStorage.setItem(
    STASH_KEY,
    JSON.stringify({
      access_token: myRealSession.access_token,
      refresh_token: myRealSession.refresh_token,
    })
  );
  await supabase.auth.setSession({
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  });
  setPreviewModeActive(true);
  return { ok: true };
}

/** "데스크톱으로 돌아가기" — stash해둔 개발자 본인 세션을 그대로 복원한다. */
export async function stopStudentPreview(): Promise<void> {
  const supabase = createClient();
  const raw = sessionStorage.getItem(STASH_KEY);
  setPreviewModeActive(false);
  sessionStorage.removeItem(STASH_KEY);
  if (!raw) {
    // stash가 없는 상태로(예: 다른 탭에서) 여기 들어오면 세션을 되돌릴 방법이 없으니
    // 안전하게 로그아웃시켜 재로그인을 유도한다 — 드문 경우.
    await supabase.auth.signOut();
    return;
  }
  const stashed = JSON.parse(raw) as { access_token: string; refresh_token: string };
  await supabase.auth.setSession(stashed);
}
