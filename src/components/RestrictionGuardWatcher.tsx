"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESTRICTABLE_VIEW_PREFIXES = ["/qna", "/board"];

function nowHM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/**
 * Q&A/게시판을 이미 열어둔 학생 탭이, 새로고침 없이 가만히 있는 동안 제한 시간이
 * 시작되는 경우를 감지한다. middleware.ts의 열람 차단(사이트 제한/수업시간)은 요청이
 * 새로 들어올 때만 실행되므로, 이미 그 페이지에 머물러 있으면 시간이 지나도 아무도
 * 다시 확인해주지 않는다 — 여기서 middleware와 같은 조건을 주기적으로 다시 계산해서,
 * 제한 시간이 시작되면 /restricted로 직접 보낸다. (site)/layout.tsx에 전역으로 마운트해
 * /board/[id] 같은 상세 페이지에서도 동일하게 동작한다.
 */
export default function RestrictionGuardWatcher({ role }: { role: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const isRestrictable = RESTRICTABLE_VIEW_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (role !== "student" || !isRestrictable) return;
    const supabase = createClient();
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("site_restrictions")
        .select("is_enabled, windows")
        .eq("id", "default")
        .maybeSingle();
      if (cancelled || !data?.is_enabled) return;
      const hm = nowHM();
      const active = ((data.windows as { label?: string; start: string; end: string }[]) ?? []).find(
        (w) => hm >= w.start && hm <= w.end
      );
      if (active) {
        const params = new URLSearchParams({ start: active.start, end: active.end, from: pathname });
        if (active.label) params.set("label", active.label);
        router.replace(`/restricted?${params.toString()}`);
      }
    };

    const timer = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [role, isRestrictable, pathname, router]);

  return null;
}
