"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SectionTitle from "@/components/SectionTitle";
import DetailBackLink from "@/components/DetailBackLink";

/**
 * 구성원 조회 페이지에 숨어있는 "미스터리 인물"을 눌렀을 때 오는 이스터에그 화면.
 * /members/[id]와 겹치지 않도록 Next.js가 이 정적 세그먼트를 동적 [id] 라우트보다
 * 먼저 매칭한다 — 실제 구성원 프로필이 아니라 이 전용 화면으로 온다.
 */
export default function MysteryMemberPage() {
  const supabase = createClient();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    const { error } = await supabase.rpc("claim_easter_egg_badge");
    setClaiming(false);
    if (error) {
      setError(error.message);
      return;
    }
    setClaimed(true);
  };

  return (
    <div>
      <SectionTitle eyebrow="DIRECTORY" title="구성원 프로필" />
      <DetailBackLink href="/members" label="구성원 조회로" />

      <div className="bg-white border border-border rounded-2xl p-10 flex flex-col items-center gap-4 text-center">
        {!claimed ? (
          <>
            <p className="text-muted text-sm">이 사람은... 누구일까요?</p>
            <button
              onClick={claim}
              disabled={claiming}
              className="text-5xl font-black w-28 h-28 rounded-full bg-navy text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-60"
            >
              ???
            </button>
            {error && <p className="text-red text-sm">{error}</p>}
          </>
        ) : (
          <>
            <div className="text-5xl">🎉</div>
            <p className="font-bold">뱃지를 획득했습니다!</p>
            <Link href="/mypage" className="text-blue font-bold text-sm">
              마이페이지에서 확인하기
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
