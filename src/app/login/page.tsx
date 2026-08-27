"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
  };

  const signInWithEmail = async () => {
    setError(null);
    if (!email.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white border border-border rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="font-bold text-lg text-navy mb-1 flex items-center justify-center gap-2">
  <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white" />
  학생자치회 로그인
</div>
        <p className="text-muted text-sm my-3.5">
          Google 계정 또는 학교 이메일로 로그인하세요.
        </p>

        <button
          onClick={signInWithGoogle}
          className="w-full bg-navy text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-2"
        >
          Google 계정으로 로그인
        </button>

        <div className="text-muted text-xs my-3">또는</div>

        {sent ? (
          <div className="text-teal text-sm bg-[#E4F5EE] rounded-lg p-3">
            {email} 주소로 로그인 링크를 보냈습니다. 메일함을 확인해주세요.
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="학교 이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm mb-2"
            />
            <button
              onClick={signInWithEmail}
              className="w-full border border-navy text-navy font-bold text-sm rounded-lg px-4 py-2.5"
            >
              이메일로 로그인 링크 받기
            </button>
          </>
        )}

        {error && <div className="text-red text-xs mt-3">{error}</div>}
      </div>
    </div>
  );
}
