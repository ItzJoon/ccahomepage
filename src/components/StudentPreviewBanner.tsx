"use client";

import { useRouter } from "next/navigation";

/**
 * developer(=superadmin)가 "학생 화면 보기"로 들어왔을 때 상단에 뜨는 안내 배너.
 * 실제 role은 그대로 superadmin이라 다시 /admin으로 들어가는 것 자체는 항상 가능하지만,
 * 미리보기 중이라는 걸 잊고 헤매지 않도록 눈에 띄는 종료 버튼을 둔다.
 */
export default function StudentPreviewBanner() {
  const router = useRouter();

  const stopPreview = () => {
    document.cookie = "preview_as_student=; path=/; max-age=0";
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="bg-navy text-white text-sm font-bold text-center py-2 px-3 flex items-center justify-center gap-3">
      <span>👀 학생 화면 미리보기 중</span>
      <button onClick={stopPreview} className="underline underline-offset-2 font-bold">
        미리보기 종료 · 관리자로 돌아가기
      </button>
    </div>
  );
}
