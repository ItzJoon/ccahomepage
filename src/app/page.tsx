"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import { Pin } from "@/components/Badge";
import StreakBar from "@/components/StreakBar";
import type { Post, EventItem, MainBlock } from "@/lib/types";

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

const QUICK_MENU = [
  ["📢", "공지사항", "/notices"],
  ["🏛️", "학생자치회 소개", "/organizations"],
  ["📅", "일정 캘린더", "/calendar"],
  ["📖", "생활규정", "/rules"],
  ["💬", "Q&A", "/qna"],
  ["🙋", "마이페이지", "/mypage"],
];

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const { rows: blocks } = useRealtimeList<MainBlock>("main_blocks", {
    orderBy: { column: "order_index" },
  });
  const { rows: notices } = useRealtimeList<Post>("posts", {
    filter: (q) => q.eq("type", "notice").eq("status", "published"),
    orderBy: { column: "created_at", ascending: false },
  });
  const { rows: events } = useRealtimeList<EventItem>("events", {
    orderBy: { column: "start_at" },
  });
  const { rows: news } = useRealtimeList<Post>("posts", {
    filter: (q) => q.eq("type", "news").eq("status", "published"),
    orderBy: { column: "created_at", ascending: false },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.start_at >= today).slice(0, 3);
  const visibleBlocks = [...blocks].filter((b) => b.is_visible).sort((a, b) => a.order_index - b.order_index);

  return (
    <div>
      <div className="bg-gradient-to-br from-navy to-blue text-white rounded-2xl px-8 py-10 mb-5">
        <div className="text-xs font-bold tracking-widest text-gold uppercase mb-1">
          STUDENT SELF-GOVERNANCE
        </div>
        <h1 className="text-3xl mb-2.5">학생이 만드는 학교, 학생자치회</h1>
        <p className="text-[#D7DEEC] mb-4">
          공지·일정·소식을 한눈에 확인하고 여러분의 목소리를 Q&amp;A로 전해주세요.
        </p>
        <div className="flex gap-2.5 flex-wrap">
          <Link href="/notices" className="bg-gold text-white font-bold text-sm rounded-lg px-[18px] py-2.5">
            공지사항 보기
          </Link>
          <Link href="/qna" className="border border-white/40 text-white font-bold text-sm rounded-lg px-[18px] py-2.5">
            질문하기
          </Link>
        </div>
      </div>

      <StreakBar userId={userId} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
        {visibleBlocks.map((b) => {
          if (b.id === "notice")
            return (
              <div key={b.id} className="bg-white border border-border rounded-2xl p-5">
                <SectionTitle
                  eyebrow="NOTICE"
                  title="최신 공지"
                  action={<Link href="/notices" className="text-blue font-semibold text-sm">전체보기</Link>}
                />
                <ul className="list-none m-0 p-0">
                  {notices.slice(0, 5).map((n) => (
                    <li key={n.id} className="border-b border-border py-2.5">
                      <Link href={`/notices/${n.id}`} className="flex items-center gap-2 hover:opacity-70">
                        {n.is_pinned && <Pin />}
                        <span className="flex-1 text-sm">{n.title}</span>
                        <span className="text-xs text-muted">{fmt(n.publish_at)}</span>
                      </Link>
                    </li>
                  ))}
                  {notices.length === 0 && <li className="text-muted text-center py-6 text-sm">등록된 공지가 없습니다.</li>}
                </ul>
              </div>
            );
          if (b.id === "event")
            return (
              <div key={b.id} className="bg-white border border-border rounded-2xl p-5">
                <SectionTitle
                  eyebrow="SCHEDULE"
                  title="다가오는 일정"
                  action={<Link href="/calendar" className="text-blue font-semibold text-sm">전체보기</Link>}
                />
                <div className="flex flex-col gap-2.5">
                  {upcoming.map((e) => (
                    <Link
                      href={`/events/${e.id}`}
                      key={e.id}
                      className="flex gap-3 items-center p-1.5 rounded-lg hover:bg-[#F2F4F8]"
                    >
                      <div className="bg-navy text-white rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">
                        {fmt(e.start_at).slice(5)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{e.title}</div>
                        <div className="text-xs text-muted">{e.location || "장소 미정"}</div>
                      </div>
                    </Link>
                  ))}
                  {upcoming.length === 0 && <div className="text-muted text-center py-6 text-sm">예정된 일정이 없습니다.</div>}
                </div>
              </div>
            );
          if (b.id === "news")
            return (
              <div key={b.id} className="bg-white border border-border rounded-2xl p-5 md:col-span-2">
                <SectionTitle
                  eyebrow="NEWS"
                  title="학생자치회 뉴스"
                  action={<Link href="/news" className="text-blue font-semibold text-sm">전체보기</Link>}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {news.slice(0, 3).map((n) => (
                    <Link
                      href={`/news/${n.id}`}
                      key={n.id}
                      className="border border-border rounded-xl p-4 hover:border-blue block"
                    >
                      <div className="text-teal font-bold text-xs mb-1.5">{n.category}</div>
                      <div className="font-bold mb-2">{n.title}</div>
                      <p className="text-sm text-muted line-clamp-3 m-0">{n.content}</p>
                    </Link>
                  ))}
                  {news.length === 0 && <div className="text-muted text-center py-6 text-sm">등록된 뉴스가 없습니다.</div>}
                </div>
              </div>
            );
          if (b.id === "quick")
            return (
              <div key={b.id} className="bg-white border border-border rounded-2xl p-5 md:col-span-2">
                <SectionTitle eyebrow="QUICK MENU" title="빠른 메뉴" />
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
                  {QUICK_MENU.map(([icon, label, href]) => (
                    <Link
                      href={href}
                      key={href}
                      className="bg-[#F2F4F8] hover:bg-[#E7ECF5] rounded-xl px-2 py-4 flex flex-col items-center gap-1.5 text-sm font-semibold"
                    >
                      <span className="text-2xl">{icon}</span>
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          return null;
        })}
      </div>
    </div>
  );
}
