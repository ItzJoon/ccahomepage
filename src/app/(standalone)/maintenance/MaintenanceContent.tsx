"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SiteSettings } from "@/lib/types";

export default function MaintenanceContent() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  // site_settings 조회가 끝나기 전까지는 "점검 중" 문구를 아예 그리지 않는다 — 실제로는
  // 점검이 끝났는데도(row.maintenance_mode === false) 리다이렉트되기 직전 한 프레임 동안
  // "사이트 점검 중" 문구가 잠깐 보였다 사라지는(깜빡임) 문제가 있었다.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase
      .from("site_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        const row = data as SiteSettings | null;
        setSettings(row);
        setChecked(true);
        // /maintenance는 미들웨어가 URL은 그대로 두고 내용만 이 화면으로 바꿔치기(rewrite)
        // 해서 보여주는 것과 별개로, 이 주소를 직접 열어둔 상태에서 점검이 끝나면 미들웨어가
        // 더 이상 안 가로채도 이 페이지 자체는 그대로 남아있는다 — 여기서 직접 최신 상태를
        // 한 번 더 확인해서, 점검이 끝났으면 홈으로 돌려보낸다.
        if (row && !row.maintenance_mode) {
          router.replace("/");
        }
      });
  }, [supabase, router]);

  // 조회 전이거나, 조회 결과 점검 중이 아니라면(곧 위에서 홈으로 리다이렉트됨) 화면에
  // "점검 중" 문구를 아예 그리지 않는다.
  if (!checked || !settings?.maintenance_mode) {
    return <div className="min-h-[70vh]" />;
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const untilLabel = settings?.maintenance_until_unknown
    ? "미정"
    : settings?.maintenance_until
    ? settings.maintenance_until.replaceAll("-", ".")
    : null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <div className="bg-surface border border-border rounded-2xl p-8 text-center max-w-md w-full shadow-sm">
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
