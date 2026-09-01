"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccessRestrictedPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 명단에 아예 없는 외부 계정과 관리자가 직접 영구 차단한 계정 모두 이 화면으로
  // 오는데, reason은 차단 시에만 붙는다(directory_members.ban_reason) — 있으면
  // "차단됨"으로, 없으면 기존처럼 일반적인 "외부 계정" 안내로 구분해서 보여준다.
  const reason = searchParams.get("reason");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <div className="bg-white border border-border rounded-2xl p-8 text-center max-w-md w-full shadow-sm">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-black mb-2">{reason ? "차단된 계정입니다" : "이용할 수 없는 계정입니다"}</h1>
        <p className="text-muted text-sm mb-2 whitespace-pre-wrap">
          {reason
            ? "신고 누적 또는 관리자 조치로 계정 이용이 영구적으로 제한되었습니다."
            : "외부 계정으로는 이용하실 수 없습니다. 학교 계정으로 로그인해주세요.\n관리자 승인을 기다리시려면 잠시만 기다려주세요."}
        </p>
        {reason && (
          <p className="text-sm bg-bg rounded-lg px-3 py-2 mb-2 text-left">
            <span className="font-bold">사유:</span> {reason}
          </p>
        )}
        {email && <p className="text-xs text-muted mb-5">현재 로그인된 계정: {email}</p>}
        <button onClick={signOut} className="bg-navy text-white font-bold text-sm rounded-lg px-6 py-3">
          로그아웃하고 다시 로그인
        </button>
      </div>
    </div>
  );
}
