"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function SuspendedPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const until = searchParams.get("until");
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
        <div className="text-4xl mb-3">⏳</div>
        <h1 className="text-xl font-black mb-2">일시 정지된 계정입니다</h1>
        <p className="text-muted text-sm mb-2 whitespace-pre-wrap">
          신고 누적 또는 관리자 조치로 계정 이용이 일시적으로 제한되었습니다.{"\n"}
          정지 기간이 지나면 자동으로 다시 이용할 수 있습니다.
        </p>
        {until && (
          <p className="text-sm font-bold text-red mb-2">{fmt(until)}까지 정지</p>
        )}
        {email && <p className="text-xs text-muted mb-5">현재 로그인된 계정: {email}</p>}
        <button onClick={signOut} className="bg-navy text-white font-bold text-sm rounded-lg px-6 py-3">
          로그아웃
        </button>
      </div>
    </div>
  );
}
