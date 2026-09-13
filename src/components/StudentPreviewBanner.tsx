"use client";

import { useState } from "react";
import { stopStudentPreview } from "@/lib/studentPreview";

/**
 * 전용 미리보기 학생 계정 세션으로 들어와 있을 때 상단에 뜨는 안내 배너(src/lib/
 * studentPreview.ts 참고 — 진짜 세션 전환이라 이 배너가 없으면 지금 로그인된 게 어느
 * 계정인지 헷갈리기 쉽다). 종료하면 미리보기 직전에 저장해둔 개발자 본인 세션을 그대로
 * 복원한다.
 */
export default function StudentPreviewBanner() {
  const [stopping, setStopping] = useState(false);

  const stopPreview = async () => {
    setStopping(true);
    await stopStudentPreview();
    window.location.href = "/admin";
  };

  return (
    <div className="bg-navy text-white text-sm font-bold text-center py-2 px-3 flex items-center justify-center gap-3">
      <span>👀 학생 화면 미리보기 중 (전용 미리보기 계정 · 글쓰기 등 쓰기 작업은 차단됨)</span>
      <button onClick={stopPreview} disabled={stopping} className="underline underline-offset-2 font-bold disabled:opacity-60">
        {stopping ? "복원 중…" : "미리보기 종료 · 관리자로 돌아가기"}
      </button>
    </div>
  );
}
