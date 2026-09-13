"use client";

import { useEffect, useState } from "react";

/**
 * 미리보기 학생 계정 세션에서 글쓰기/좋아요/체크인 등 쓰기 액션을 시도하면
 * src/lib/supabase/client.ts의 Proxy가 실제 요청을 막고 "preview-write-blocked"
 * 커스텀 이벤트를 쏜다 — 여기서 그 이벤트를 받아 잠깐 토스트로 안내한다. 미리보기가
 * 아닌 일반 방문자에게는 이 이벤트 자체가 절대 발생하지 않으므로 항상 마운트해둬도 무해하다.
 */
export default function PreviewWriteBlockedToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onBlocked = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      setMessage(detail?.message || "미리보기 모드에서는 이 작업을 할 수 없습니다.");
      setTimeout(() => setMessage(null), 3000);
    };
    window.addEventListener("preview-write-blocked", onBlocked);
    return () => window.removeEventListener("preview-write-blocked", onBlocked);
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] bg-navy text-white text-sm font-bold rounded-full px-5 py-3 shadow-lg">
      🚫 {message}
    </div>
  );
}
