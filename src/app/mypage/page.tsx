"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAttendance } from "@/hooks/useAttendance";
import SectionTitle from "@/components/SectionTitle";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function MyPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const { streak, history, checkedToday, checkIn, loading } = useAttendance(userId ?? null);

  if (userId === undefined) return null;
  if (userId === null) {
    return (
      <div className="text-center py-14">
        <p className="text-muted mb-3">로그인 후 마이페이지를 이용할 수 있습니다.</p>
        <Link href="/login" className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2.5">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle eyebrow="MY PAGE" title="마이페이지" />
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        <div className="bg-white border border-border rounded-2xl p-5 text-center flex flex-col items-center gap-2">
          <div className="font-serif font-black text-4xl">{loading ? "-" : streak}</div>
          <div className="text-muted text-sm">연속 접속일수</div>
          {!loading && !checkedToday && (
            <button onClick={checkIn} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-1.5 mt-1">
              오늘 접속 체크
            </button>
          )}
          {checkedToday && <span className="text-teal font-bold text-sm">오늘 접속 완료 ✓</span>}
        </div>
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="text-xs font-bold tracking-widest text-blue uppercase mb-1">VISIT HISTORY</div>
          <h3>최근 방문 기록 (최근 30일)</h3>
          <ul className="list-none m-0 p-0">
            {history.slice(0, 10).map((d) => (
              <li key={d} className="border-b border-border py-2.5 text-sm">
                {fmt(d)}
              </li>
            ))}
            {history.length === 0 && <div className="text-muted text-center py-6 text-sm">방문 기록이 없습니다.</div>}
          </ul>
        </div>
      </div>
    </div>
  );
}
