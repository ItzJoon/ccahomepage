"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { playAttachedSound } from "@/lib/notificationSound";
import { notificationTargetsMe } from "@/lib/notificationAudience";
import { scheduleSafeTimeout } from "@/lib/safeTimeout";
import type { NotificationItem } from "@/lib/types";

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

/** display_until이 없으면 계속 표시(무기한), 있으면 그 시각이 지나면 만료 처리 */
function isExpired(n: NotificationItem) {
  if (!n.display_until) return false;
  return Date.now() > new Date(n.display_until).getTime();
}

function sortByDisplayOrder(list: NotificationItem[]) {
  return [...list].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

/**
 * 관리자가 알림 발송 센터에서 notifications 테이블에 INSERT 하는 순간,
 * Supabase Realtime을 통해 접속 중인 모든 학생 화면에 즉시 배너로 표시됩니다.
 * 이미 만료된 배너는 layout.tsx의 초기 조회 단계에서부터 서버가 내려주지 않으므로,
 * 여기서의 isExpired 체크는 방어적 목적(페이지를 오래 열어둔 사이 만료된 경우)입니다.
 *
 * 노출 기간이 겹치는 배너가 2개 이상이면(예전엔 최신 것 하나만 보이고 나머지는 그냥
 * 가려졌음 — 실제로는 "쌓이는" 게 아니라 "묻히는" 문제였다) 하나의 캐러셀로 자동 전환하며
 * 모두 보여준다. 1개뿐이면 캐러셀 UI(화살표/점) 없이 기존처럼 단일 표시.
 */
export default function NotificationBanner({
  initial,
  soundEnabled = true,
  userEmail,
}: {
  initial: NotificationItem[];
  soundEnabled?: boolean;
  /** 발송 대상 지정(audience_emails)이 있는 알림을 realtime으로 새로 받았을 때, 이
   * 화면 주인이 대상인지 판단하는 데 쓴다. 초기 목록은 이미 서버에서 걸러져서 온다. */
  userEmail?: string | null;
}) {
  const [banners, setBanners] = useState<NotificationItem[]>(() => sortByDisplayOrder(initial.filter((n) => !isExpired(n))));
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);

  const active = useMemo(() => banners.filter((n) => !dismissedIds.includes(n.id)), [banners, dismissedIds]);
  const current = active[index % Math.max(active.length, 1)] ?? null;

  // active 배열이 바뀌어서(새 배너 도착/만료/닫기) 인덱스가 범위를 벗어나면 안전하게 되돌린다.
  useEffect(() => {
    if (index >= active.length && active.length > 0) setIndex(0);
  }, [active.length, index]);

  // 알림마다 "처음 노출됐을 때" 딱 한 번만 사운드를 재생한다 — 캐러셀이 자동/수동으로
  // 한 바퀴 돌아 같은 슬라이드로 돌아와도 다시 재생되지 않는다(이미 재생한 id는 세션
  // 동안 기억해둔다).
  useEffect(() => {
    if (current && soundEnabled && !playedIdsRef.current.has(current.id)) {
      playedIdsRef.current.add(current.id);
      playAttachedSound(current.sound_url);
    }
  }, [current, soundEnabled]);

  // 배너가 2개 이상일 때만 자동으로 다음 슬라이드로 넘어간다.
  useEffect(() => {
    if (active.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % active.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [active.length, index]);

  useEffect(() => {
    const supabase = createClient();
    // 구독 직후 수 초 이내 도착하는 UPDATE는 무시한다 — NotificationPopup.tsx와 동일한
    // 이유(채널을 새로 열 때 지연된 과거 이벤트가 뒤늦게 도착하는 경우가 관찰됨).
    const subscribedAt = Date.now();
    const isStaleEvent = () => Date.now() - subscribedAt < 3000;

    const channel = supabase
      .channel("public:notifications:banner")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as NotificationItem;
          if (n.display_type === "banner" && !isExpired(n) && notificationTargetsMe(n.audience_emails, userEmail)) {
            setBanners((b) => (b.some((x) => x.id === n.id) ? b : sortByDisplayOrder([...b, n])));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          if (isStaleEvent()) return;
          const n = payload.new as NotificationItem;
          setBanners((b) => (isExpired(n) ? b.filter((x) => x.id !== n.id) : b.map((x) => (x.id === n.id ? n : x))));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          if (isStaleEvent()) return;
          const old = payload.old as { id: string };
          setBanners((b) => b.filter((x) => x.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // 노출 종료 시각이 정해진 배너는, 페이지를 계속 열어둔 사이 그 시각이 지나는 순간
  // 자동으로 목록에서 뺀다(캐러셀이 돌고 있어도 그 슬라이드만 사라짐).
  useEffect(() => {
    if (!current || !current.display_until) return;
    const remaining = new Date(current.display_until).getTime() - Date.now();
    return scheduleSafeTimeout(() => setBanners((b) => b.filter((x) => x.id !== current.id)), remaining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const goTo = (next: number) => {
    if (active.length === 0) return;
    setIndex(((next % active.length) + active.length) % active.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    goTo(index + (delta < 0 ? 1 : -1));
  };

  if (!current) return null;

  return (
    <div
      className={`relative flex items-center gap-2.5 px-5 py-2.5 border-b max-w-[1180px] mx-auto w-full ${
        current.level === "urgent"
          ? "bg-[#FDEBEC] dark:bg-white/10 border-[#F3B9BC] dark:border-white/15"
          : "bg-[#FFF7E6] dark:bg-white/10 border-[#F3D98A] dark:border-white/15"
      }`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {active.length > 1 && (
        <button
          onClick={() => goTo(index - 1)}
          className="text-muted text-sm shrink-0 px-1"
          aria-label="이전 알림"
        >
          ‹
        </button>
      )}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: current.level === "urgent" ? "var(--red)" : "var(--gold)" }}
      />
      <div className="flex gap-2 flex-1 flex-wrap text-sm min-w-0">
        <strong>{current.title}</strong>
        <span>{current.message}</span>
      </div>
      {active.length > 1 && (
        <>
          <div className="flex items-center gap-1 shrink-0">
            {active.map((n, i) => (
              <button
                key={n.id}
                onClick={() => goTo(i)}
                aria-label={`${i + 1}번째 알림 보기`}
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: i === index % active.length ? "currentColor" : "currentColor", opacity: i === index % active.length ? 1 : 0.3 }}
              />
            ))}
          </div>
          <button
            onClick={() => goTo(index + 1)}
            className="text-muted text-sm shrink-0 px-1"
            aria-label="다음 알림"
          >
            ›
          </button>
        </>
      )}
      <button
        onClick={() => setDismissedIds((d) => [...d, current.id])}
        className="text-muted text-sm shrink-0"
        aria-label="알림 닫기"
      >
        ✕
      </button>
    </div>
  );
}
