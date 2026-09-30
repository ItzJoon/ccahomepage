"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 정지(is_suspended) 중인 사용자에게 사이트 어디서든 보이는 안내 배너. 정지는 더 이상
 * 사이트 접근 자체를 막지 않고 글쓰기만 제한하므로(middleware.ts 참고), 본인이 지금
 * 정지 중이라는 사실과 언제/어떻게 풀리는지를 알 수 있어야 글을 쓰려다 이유 모를
 * 실패를 겪지 않는다. 관리자가 실시간으로 정지를 걸거나 풀면 새로고침 없이 바로
 * 반영된다.
 */
export default function SuspensionBanner({
  userId,
  initialIsSuspended,
  initialSuspendedUntil,
  initialSuspendedReason,
}: {
  userId: string;
  initialIsSuspended: boolean;
  initialSuspendedUntil: string | null;
  initialSuspendedReason: string | null;
}) {
  const [isSuspended, setIsSuspended] = useState(initialIsSuspended);
  const [suspendedUntil, setSuspendedUntil] = useState(initialSuspendedUntil);
  const [suspendedReason, setSuspendedReason] = useState(initialSuspendedReason);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`suspension_banner_${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const row = payload.new as { is_suspended: boolean; suspended_until: string | null; suspended_reason: string | null };
            setIsSuspended(!!row.is_suspended);
            setSuspendedUntil(row.suspended_until ?? null);
            setSuspendedReason(row.suspended_reason ?? null);
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  // 일시 정지는 배치 작업 없이 시각 비교만으로 자동 해제된 것처럼 취급한다(서버 RLS의
  // is_currently_suspended()와 동일한 기준).
  const stillActive = isSuspended && (!suspendedUntil || new Date(suspendedUntil).getTime() > Date.now());
  if (!stillActive) return null;

  return (
    <div className="bg-[#FDEBEC] dark:bg-white/10 text-red text-sm px-4 py-2.5 text-center">
      ⚠️ 정지 중입니다{suspendedReason ? ` (사유: ${suspendedReason})` : ""} — 글쓰기·댓글 등 게시 활동이 제한됩니다.{" "}
      {suspendedUntil ? `${fmtDateTime(suspendedUntil)}에 자동으로 해제됩니다.` : "관리자가 해제할 때까지 유지됩니다."}
    </div>
  );
}
