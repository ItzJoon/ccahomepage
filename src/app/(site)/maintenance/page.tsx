"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SiteSettings } from "@/lib/types";

export default function MaintenancePage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase
      .from("site_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => setSettings(data as SiteSettings | null));
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const untilLabel = settings?.maintenance_until ? settings.maintenance_until.replaceAll("-", ".") : null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <div className="bg-white border border-border rounded-2xl p-8 text-center max-w-md w-full shadow-sm">
        <div className="text-4xl mb-3">🚧</div>
        <h1 className="text-xl font-black mb-2">사이트 점검 중</h1>
        <p className="text-muted text-sm mb-4 whitespace-pre-wrap">
          {settings?.maintenance_message || "현재 사이트를 점검 중입니다. 관리자 계정으로만 이용할 수 있습니다."}
        </p>
        {untilLabel && (
          <div className="inline-block bg-[#FFF3DC] text-gold text-sm font-bold rounded-lg px-4 py-2 mb-5">
            예정 종료일 {untilLabel}
          </div>
        )}
        <div className="flex justify-center">
          {userId === undefined ? null : userId === null ? (
            <Link href="/login" className="inline-block bg-navy text-white font-bold text-sm rounded-lg px-6 py-3">
              로그인
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted">관리자 계정으로만 접속할 수 있어요. 다른 계정으로 로그인하려면 로그아웃해 주세요.</p>
              <button onClick={signOut} className="bg-navy text-white font-bold text-sm rounded-lg px-6 py-3">
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
