"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * 헤더의 프로필 메뉴 "닉네임 · 소개 수정"에서 뜨는 간단 수정 모달. 마이페이지까지 이동하지
 * 않고 바로 바꿀 수 있게 한 것으로, 실제 저장 로직은 마이페이지의 프로필 수정과 동일하다.
 */
export default function ProfileQuickEditModal({
  userId,
  initialNickname,
  initialBio,
  onClose,
}: {
  userId: string;
  initialNickname: string;
  initialBio: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ nickname: nickname.trim() || null, bio: bio.trim() || null })
      .eq("id", userId);
    setSaving(false);
    onClose();
    // 헤더의 표시 이름은 서버 레이아웃에서 내려주는 profile prop 기준이라, 새로고침 없이
    // 즉시 반영되도록 서버 컴포넌트를 다시 렌더링시킨다.
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-1">닉네임 · 소개 수정</h3>
        <label className="text-xs font-bold text-muted mt-2">표시 이름 (닉네임)</label>
        <input
          autoFocus
          className="border border-border rounded-lg px-2.5 py-2 text-sm"
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(e.target.value)}
        />
        <label className="text-xs font-bold text-muted mt-2">자기소개 한 줄</label>
        <input
          className="border border-border rounded-lg px-2.5 py-2 text-sm"
          value={bio}
          maxLength={60}
          onChange={(e) => setBio(e.target.value)}
        />
        <div className="flex gap-2 mt-3.5">
          <button onClick={save} disabled={saving} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
            {saving ? "저장 중…" : "저장"}
          </button>
          <button onClick={onClose} className="border border-border text-sm rounded-lg px-4 py-2">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
