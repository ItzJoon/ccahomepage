"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { Pin } from "@/components/Badge";
import StreakBar from "@/components/StreakBar";
import ImageLightbox from "@/components/ImageLightbox";
import WeatherWidget from "@/components/WeatherWidget";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import { useStudentPreview } from "@/lib/studentPreviewContext";
import { todayKST } from "@/lib/date";
import type { homeThemeStyles, HomeThemeKey } from "@/lib/homeTheme";
import type { Post, EventItem, MainBlock, MealPlan } from "@/lib/types";

type Theme = (typeof homeThemeStyles)[keyof typeof homeThemeStyles];

// Tailwind는 클래스 이름을 소스에서 문자열 그대로 찾아야 인식하므로(JIT), `md:col-span-${n}`
// 처럼 동적으로 이어붙이면 실제 빌드에 포함되지 않는다. 완성된 문자열을 미리 다 적어두고
// col_span 값으로 골라 쓴다. 6칸 기준 그리드라 1/3=2, 1/2=3, 2/3=4, 전체=6이다.
const COL_SPAN_CLASS: Record<number, string> = {
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
};

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

const QUICK_MENU = [
  ["📢", "공지사항", "/notices"],
  ["🏛️", "학생자치회 소개", "/organizations"],
  ["📅", "일정 캘린더", "/calendar"],
  ["📖", "생활규정", "/rules"],
  ["💬", "Q&A", "/qna"],
  ["🙋", "마이페이지", "/mypage"],
];

// 홈 화면 전용 블록 제목. 다른 페이지에서 두루 쓰는 SectionTitle과는 별개로 두어(공용
// 컴포넌트를 건드리면 다른 페이지 톤까지 바뀌므로) 여기서만 테마별 제목 스타일을 적용한다.
function BlockTitle({
  eyebrow,
  title,
  moreHref,
  t,
}: {
  eyebrow: string;
  title: string;
  moreHref?: string;
  t: Theme;
}) {
  return (
    <div className="flex justify-between items-end mb-4 gap-3 flex-wrap">
      <div>
        <div className={t.sectionEyebrow}>{eyebrow}</div>
        <div className="flex items-center gap-2.5">
          <span className={`w-1 h-6 ${t.sectionAccentBar} bg-current ${t.sectionAccentColor}`} />
          <h2 className={t.sectionHeadingClass}>{title}</h2>
        </div>
      </div>
      {moreHref && (
        <Link href={moreHref} className={t.sectionMoreBtn}>
          전체보기 ›
        </Link>
      )}
    </div>
  );
}

// 공지/일정/뉴스 각 카드가 비어있을 때 보여주는 자리. classic/green은 지금까지처럼 문구
// 한 줄만 보이고(emptyStateIconWrap/Desc가 hidden), apple은 아이콘 원 + 제목 + 설명 2줄로 보인다.
function EmptyState({ icon, title, desc, t }: { icon: string; title: string; desc: string; t: Theme }) {
  return (
    <div className={t.emptyStateWrap}>
      <div className={t.emptyStateIconWrap}>{icon}</div>
      <div className={t.emptyStateTitle}>{title}</div>
      <div className={t.emptyStateDesc}>{desc}</div>
    </div>
  );
}

export default function HomeContent({ initialThemeKey }: { initialThemeKey?: HomeThemeKey }) {
  const [userId, setUserId] = useState<string | null>(null);
  const { t } = useHomeTheme(initialThemeKey);
  // "학생 화면 보기" 미리보기 중에는 editor 이상에게만 보이는 숨김 처리된 공지/일정/뉴스가
  // 실제 세션(superadmin)의 RLS 예외 때문에 그대로 딸려오므로, 진짜 학생이 보는 모습과
  // 같아지도록 여기서 한 번 더 걸러낸다.
  const previewAsStudent = useStudentPreview();
  const { rows: blocks } = useRealtimeList<MainBlock>("main_blocks", {
    orderBy: { column: "order_index" },
  });
  const { rows: notices } = useRealtimeList<Post>("posts", {
    filter: (q) => {
      let query = q.eq("type", "notice").eq("status", "published");
      if (previewAsStudent) query = query.eq("is_hidden", false);
      return query;
    },
    orderBy: { column: "created_at", ascending: false },
  });
  const { rows: events } = useRealtimeList<EventItem>("events", {
    filter: (q) => (previewAsStudent ? q.eq("is_hidden", false) : q),
    orderBy: { column: "start_at" },
  });
  const { rows: news } = useRealtimeList<Post>("posts", {
    filter: (q) => {
      let query = q.eq("type", "news").eq("status", "published");
      if (previewAsStudent) query = query.eq("is_hidden", false);
      return query;
    },
    orderBy: { column: "created_at", ascending: false },
  });
  const { rows: mealPlans } = useRealtimeList<MealPlan>("meal_plans");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const today = todayKST();
  const upcoming = events.filter((e) => e.start_at >= today).slice(0, 3);
  const visibleBlocks = [...blocks].filter((b) => b.is_visible).sort((a, b) => a.order_index - b.order_index);
  const thisMonth = mealPlans.find(
    (m) => m.year === Number(today.slice(0, 4)) && m.month === Number(today.slice(5, 7))
  );

  return (
    <div>
      <div className={t.heroCard}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={t.heroEyebrow}>{t.heroEyebrowText}</div>
            <h1 className={t.heroHeadingClass}>{t.heroTitleText}</h1>
          </div>
          <WeatherWidget />
        </div>
        <p className={t.heroSubtextClass}>{t.heroSubtitleText}</p>
        <div className="flex gap-2.5 flex-wrap">
          <Link href="/notices" className={t.heroPrimaryBtn}>
            공지사항 보기
          </Link>
          <Link href="/qna" className={t.heroSecondaryBtn}>
            질문하기
          </Link>
        </div>
      </div>

      <StreakBar userId={userId} initialThemeKey={initialThemeKey} />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-[18px]">
        {visibleBlocks.map((b) => {
          const spanClass = COL_SPAN_CLASS[b.col_span] ?? COL_SPAN_CLASS[6];
          if (b.id === "notice")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass} flex flex-col`}>
                <BlockTitle t={t} eyebrow="NOTICE" title="최신 공지" moreHref="/notices" />
                <div className="flex-1 flex flex-col justify-center">
                  <ul className="list-none m-0 p-0">
                    {notices.slice(0, 5).map((n) => (
                      <li key={n.id} className="border-b border-border py-2.5">
                        <Link href={`/notices/${n.id}`} className={`flex items-center gap-2 -mx-2 px-2 rounded ${t.noticeHover}`}>
                          {n.is_pinned && <Pin />}
                          <span className="flex-1 text-sm">{n.title}</span>
                          <span className="text-xs text-muted">{fmt(n.publish_at)}</span>
                        </Link>
                      </li>
                    ))}
                    {notices.length === 0 && (
                      <li>
                        <EmptyState icon="🔕" title="등록된 공지글이 없습니다" desc="최근에 작성된 공지사항이 이곳에 표시됩니다." t={t} />
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            );
          if (b.id === "event")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass} flex flex-col`}>
                <BlockTitle t={t} eyebrow="SCHEDULE" title="다가오는 일정" moreHref="/calendar" />
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex flex-col gap-2.5">
                    {upcoming.map((e) => (
                      <Link
                        href={`/events/${e.id}`}
                        key={e.id}
                        className={`flex gap-3 items-center p-1.5 rounded-lg ${t.noticeHover}`}
                      >
                        <div className={`${t.eventDateBg} text-white px-2.5 py-1.5 text-xs font-bold whitespace-nowrap`}>
                          {fmt(e.start_at).slice(5)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{e.title}</div>
                          <div className="text-xs text-muted">{e.location || "장소 미정"}</div>
                        </div>
                      </Link>
                    ))}
                    {upcoming.length === 0 && (
                      <EmptyState icon="📅" title="다가오는 예정된 일정이 없습니다" desc="학사 일정 및 자치회 행사 정보가 등록되면 업데이트됩니다." t={t} />
                    )}
                  </div>
                </div>
              </div>
            );
          if (b.id === "news")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass} flex flex-col`}>
                <BlockTitle t={t} eyebrow="NEWS" title="학생자치회 뉴스" moreHref="/news" />
                <div className="flex-1 flex flex-col justify-center">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {news.slice(0, 3).map((n) => (
                      <Link
                        href={`/news/${n.id}`}
                        key={n.id}
                        className={`border border-border rounded-xl p-4 ${t.newsHoverBorder} block`}
                      >
                        <div className="text-teal font-bold text-xs mb-1.5">{n.category}</div>
                        <div className="font-bold mb-2">{n.title}</div>
                        <p className="text-sm text-muted line-clamp-3 m-0">{n.content}</p>
                      </Link>
                    ))}
                    {news.length === 0 && (
                      <div className="md:col-span-3">
                        <EmptyState icon="📰" title="발행된 뉴스가 존재하지 않습니다" desc="자치회 활동 소식지와 행사 리뷰를 준비 중입니다." t={t} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          if (b.id === "meal")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass}`}>
                <BlockTitle t={t} eyebrow="MEAL" title="이번 달 급식표" />
                {thisMonth ? (
                  <ImageLightbox
                    src={thisMonth.image_url}
                    alt={`${thisMonth.year}년 ${thisMonth.month}월 급식표`}
                    className="w-full rounded-lg border border-border object-contain"
                  />
                ) : (
                  <EmptyState icon="🍽️" title="등록된 이번 달 급식표가 없습니다" desc="관리자가 급식표를 업로드하면 이곳에 표시됩니다." t={t} />
                )}
              </div>
            );
          if (b.id === "quick")
            return (
              <div key={b.id} className={`${t.cardShape} p-5 ${spanClass}`}>
                <BlockTitle t={t} eyebrow="QUICK MENU" title="빠른 메뉴" />
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
                  {QUICK_MENU.map(([icon, label, href]) => (
                    <Link
                      href={href}
                      key={href}
                      className={`${t.quickTile} flex flex-col items-center gap-1.5 text-sm font-semibold`}
                    >
                      {t.quickShowIcon && <span className="text-2xl">{icon}</span>}
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
