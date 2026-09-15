"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// useSearchParams()를 쓰는 페이지는 Suspense로 감싸야 빌드 시 정적 생성이 된다(안 감싸면
// "CSR bailout"으로 처리돼 강제로 동적 렌더링돼서, 이 페이지처럼 서버에서 할 일이 전혀
// 없는(전부 클라이언트에서 처리) 화면도 매 요청마다 서버리스 함수가 뜨게 된다) — 감싸주면
// 빌드 때 한 번 정적 HTML로 만들어져서 이후엔 서버 실행 비용이 아예 없다.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
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
      <div className="bg-surface border border-border rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="font-bold text-lg mb-1 flex items-center justify-center gap-2">
  <img src="/logo.png" alt="학생자치회 로고" className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-white/90" />
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
              className="w-full border border-navy text-navy dark:border-white/25 dark:text-white font-bold text-sm rounded-lg px-4 py-2.5"
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
