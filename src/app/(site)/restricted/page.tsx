"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Window = { label?: string; start: string; end: string };

function nowHM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/**
 * 사이트 제한(수업시간 등) 시간대에 학생 계정이 Q&A/게시판에 접속하면 middleware.ts가
 * 여기로 돌려보낸다. 다른 메뉴(공지/뉴스/일정 등)는 이 시간에도 그대로 열람 가능해서
 * /suspended·/access-restricted처럼 사이트 전체를 막는 화면이 아니라, 홈으로 돌아가는
 * 링크만 안내한다.
 *
 * middleware는 /qna, /board로 향하는 요청에서만 다시 실행되므로, 이 페이지에 그대로
 * 머무는 동안(또는 이 URL을 새로고침하는 동안)에는 시간이 지나 제한이 풀려도 아무도
 * 다시 확인해주지 않아 안내 화면이 영원히 떠 있는 문제가 있었다. 그래서 여기서 직접
 * site_restrictions를 주기적으로 다시 조회해서, 지금도 정말 제한 시간인지 스스로
 * 확인하고, 풀렸으면 원래 가려던 페이지(from)로 되돌아간다.
 */
export default function RestrictedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const label = searchParams.get("label");
  const from = searchParams.get("from") || "/";
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("site_restrictions")
        .select("is_enabled, windows")
        .eq("id", "default")
        .maybeSingle();
      if (cancelled) return;
      const hm = nowHM();
      const stillRestricted =
        !!data?.is_enabled &&
        ((data.windows as Window[]) ?? []).some((w) => hm >= w.start && hm <= w.end);
      if (!stillRestricted) {
        router.replace(from);
        return;
      }
      setChecked(true);
    };

    check();
    // 새로고침 없이 머물러 있어도 제한이 풀리는 순간 자동으로 원래 페이지로 돌아가도록
    // 짧은 주기로 다시 확인한다(관리자가 도중에 제한을 꺼도 마찬가지로 반영됨).
    const timer = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) return null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <div className="bg-white border border-border rounded-2xl p-8 text-center max-w-md w-full shadow-sm">
        <div className="text-4xl mb-3">🔔</div>
        <h1 className="text-xl font-black mb-2">지금은 이용 시간이 아니에요</h1>
        <p className="text-muted text-sm mb-2 whitespace-pre-wrap">
          현재 수업시간이라 Q&A/게시판 이용이 제한되어 있어요.{"\n"}
          제한 시간이 끝나면 다시 이용할 수 있습니다.
        </p>
        {start && end && (
          <p className="text-sm font-bold text-red mb-5">
            제한 시간: {label && `${label} `}{start}~{end}
          </p>
        )}
        <Link href="/" className="inline-block bg-navy text-white font-bold text-sm rounded-lg px-6 py-3">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
