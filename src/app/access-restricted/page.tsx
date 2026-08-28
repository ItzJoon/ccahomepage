"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccessRestrictedPage() {
  const supabase = createClient();
  const router = useRouter();
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
        <h1 className="text-xl font-black mb-2">이용할 수 없는 계정입니다</h1>
        <p className="text-muted text-sm mb-2 whitespace-pre-wrap">
          외부 계정으로는 이용하실 수 없습니다. 학교 계정으로 로그인해주세요.{"\n"}
          관리자 승인을 기다리시려면 잠시만 기다려주세요.
        </p>
        {email && <p className="text-xs text-muted mb-5">현재 로그인된 계정: {email}</p>}
        <button onClick={signOut} className="bg-navy text-white font-bold text-sm rounded-lg px-6 py-3">
          로그아웃하고 다시 로그인
        </button>
      </div>
    </div>
  );
}
