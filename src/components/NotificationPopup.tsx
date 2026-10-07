"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";
import { playAttachedSound } from "@/lib/notificationSound";
import { notificationTargetsMe } from "@/lib/notificationAudience";
import { scheduleSafeTimeout } from "@/lib/safeTimeout";
import type { NotificationItem } from "@/lib/types";

// "오늘 하루 안 보기"는 계정이 아니라 이 브라우저(localStorage)에 저장되는데, developer
// 전용 "학생 화면 보기"가 같은 브라우저 안에서 진짜 세션을 전용 미리보기 학생 계정으로
// 바꿔치기하는 방식이라(src/lib/studentPreview.ts), scopeKey(로그인한 사용자 id) 없이
// 그냥 notif_hide_${id}로만 저장하면 개발자 본인 계정에서 "오늘 하루 안 보기"를 누른
// 알림이 미리보기 계정에서도(또는 그 반대도) 똑같이 숨어버려서 "미리보기는 항상 신규
// 학생처럼 보여야 한다"는 요구를 깨버린다. 그래서 로그인한 사용자 id를 키에 포함시켜
// 계정별로 완전히 분리한다.
function isHiddenToday(id: string, scopeKey: string) {
  return localStorage.getItem(`notif_hide_${scopeKey}_${id}`) === todayKST();
}

/** display_until이 없으면 계속 표시(무기한), 있으면 그 시각이 지나면 만료 처리 */
function isExpired(n: NotificationItem) {
  if (!n.display_until) return false;
  return Date.now() > new Date(n.display_until).getTime();
}

function isQueueable(n: NotificationItem, scopeKey: string) {
  return n.popup_active && !isExpired(n) && !isHiddenToday(n.id, scopeKey);
}

/**
 * display_type이 'popup'인 알림을 페이지 진입 시 모달로 띄웁니다.
 * 배너와 달리 학생이 "확인" 또는 "오늘 하루 안 보기"를 눌러야 사라집니다.
 * "오늘 하루 안 보기"는 이 브라우저(localStorage)에만 저장되어, 같은 학생이라도
 * 다른 기기/브라우저에서는 다시 뜹니다.
 *
 * 동시에 여러 개가 활성화돼 있으면(예: 관리자가 팝업 3개를 켜둔 상태) 전부 큐에
 * 담아뒀다가 한 번에 하나씩만 보여준다. 확인/오늘 하루 안 보기/ESC를 누르면 지금 보던
 * 걸 큐에서 완전히 제거하고 다음 것을 보여주며(기존과 동일한 "확인 필수" 동작), 추가로
 * 양옆 화살표 버튼으로 큐를 제거하지 않고 자유롭게 앞뒤로 넘겨볼 수도 있다(배너 캐러셀과
 * 같은 이동 방식). 새로 들어오는 알림(realtime INSERT)은 지금 보고 있는 걸 밀어내지
 * 않고 큐 뒤에 붙는다.
 *
 * 관리자가 "팝업 중지"(popup_active=false)를 누르거나 기록 자체를 삭제하거나,
 * 노출 기간(display_until)이 지나면(또는 "지금 바로 내리기"로 그 시각을 현재로
 * 앞당기면) 큐에서(지금 보고 있는 중이든 대기 중이든) 즉시 제거된다. 이미 만료된
 * 팝업은 layout.tsx의 초기 조회 단계에서부터 서버가 내려주지 않으므로, 여기서의
 * isExpired 체크는 방어적 목적(페이지를 오래 열어둔 사이 만료된 경우)입니다.
 */
export default function NotificationPopup({
  initial,
  soundEnabled = true,
  userId = null,
  userEmail = null,
}: {
  initial: NotificationItem[];
  soundEnabled?: boolean;
  userId?: string | null;
  /** 발송 대상 지정(audience_emails)이 있는 알림을 realtime으로 새로 받았을 때, 이
   * 화면 주인이 대상인지 판단하는 데 쓴다. 초기 목록은 이미 서버에서 걸러져서 온다. */
  userEmail?: string | null;
}) {
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const current = queue[index] ?? null;
  const scopeKey = userId ?? "anon";

  useEffect(() => {
    setQueue(initial.filter((n) => isQueueable(n, scopeKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, scopeKey]);

  // 큐 길이가 줄어들어(확인/오늘 하루 안 보기/만료) index가 범위를 벗어나면 안전하게 되돌린다.
  useEffect(() => {
    if (index >= queue.length && queue.length > 0) setIndex(0);
  }, [queue.length, index]);

  // 지금 보고 있는 걸 큐에서 완전히 제거하고 다음 걸로 넘어간다(확인/오늘 하루 안 보기/ESC 공용).
  // 화살표 이동(goTo)과 달리 "확인"은 큐에서 실제로 빠진다 — 기존의 "확인 필수" 의미를 그대로 유지.
  const dismiss = () => {
    if (!current) return;
    setQueue((q) => q.filter((x) => x.id !== current.id));
  };

  const hideToday = () => {
    if (!current) return;
    localStorage.setItem(`notif_hide_${scopeKey}_${current.id}`, todayKST());
    dismiss();
  };

  // 화살표/점 등으로 큐를 제거 없이 둘러볼 때 쓴다. 범위를 벗어나면 양쪽 끝에서 순환한다.
  const goTo = (next: number) => {
    if (queue.length === 0) return;
    setIndex(((next % queue.length) + queue.length) % queue.length);
  };

  // 알림마다 "처음 노출됐을 때" 딱 한 번만 사운드를 재생한다 — 화살표로 앞뒤를 오가다
  // 같은 알림으로 돌아와도 다시 재생되지 않는다(배너 캐러셀과 동일한 규칙).
  useEffect(() => {
    if (current && soundEnabled && !playedIdsRef.current.has(current.id)) {
      playedIdsRef.current.add(current.id);
      playAttachedSound(current.sound_url);
    }
  }, [current, soundEnabled]);

  useEffect(() => {
    const supabase = createClient();
    // 구독 직후(수 초 이내) 들어오는 UPDATE/DELETE 이벤트는 무시한다. 채널을 새로 열 때
    // Supabase Realtime이 그 직전에 있었던 이벤트를 지연 전달하는 경우가 실제로 관찰됐는데
    // (예: 다른 곳에서 방금 껐다 켠 팝업의 "꺼짐" 이벤트가 뒤늦게 도착), 그 상태로는 서버가
    // 이미 내려준 초기 목록(initial)이 도착 직후 곧바로(수십 ms 안에) 사라져버리는 문제가
    // 있었다. 실제 관리자가 화면을 보고 있는 도중에 알림을 수정하는 경우는 절대 이렇게
    // 빠르게 일어나지 않으므로, 이 짧은 유예 기간만 걸러도 정상 사용에는 영향이 없다.
    const subscribedAt = Date.now();
    const GRACE_MS = 3000;
    const isStaleEvent = () => Date.now() - subscribedAt < GRACE_MS;

    const channel = supabase
      .channel("public:notifications:popup")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as NotificationItem;
          if (n.display_type === "popup" && isQueueable(n, scopeKey) && notificationTargetsMe(n.audience_emails, userEmail)) {
            setQueue((q) => (q.some((x) => x.id === n.id) ? q : [...q, n]));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          if (isStaleEvent()) return;
          const n = payload.new as NotificationItem;
          setQueue((q) => (!n.popup_active || isExpired(n) ? q.filter((x) => x.id !== n.id) : q.map((x) => (x.id === n.id ? n : x))));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          if (isStaleEvent()) return;
          const old = payload.old as { id: string };
          setQueue((q) => q.filter((x) => x.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, userEmail]);

  // 노출 종료 시각이 정해진 팝업이면, 페이지를 계속 열어둔 사이 그 시각이 지나는 순간
  // 자동으로 닫고 다음 걸로 넘어간다(배너와 동일한 패턴).
  useEffect(() => {
    if (!current || !current.display_until) return;
    const remaining = new Date(current.display_until).getTime() - Date.now();
    const id = current.id;
    return scheduleSafeTimeout(() => setQueue((q) => q.filter((x) => x.id !== id)), remaining);
  }, [current]);

  // 이미지 전용 팝업의 등장 애니메이션(ImageLightbox와 동일하게 더블 rAF로 "닫힘" 상태를
  // 먼저 한 번 그리게 한 뒤 "열림"으로 넘겨야 transition이 실제로 애니메이션된다).
  useEffect(() => {
    if (!current) {
      setVisible(false);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [current?.id]);

  // 이미지 전용 팝업만 ESC로 닫히게 한다 — 텍스트 팝업은 요구사항대로 기존 동작(확인/오늘
  // 하루 안 보기 버튼으로만 닫힘)을 그대로 유지한다.
  useEffect(() => {
    if (!current?.image_url) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current]);

  if (!current) return null;

  // 큐에 2개 이상 남아있을 때만, 화면 양옆에 떠서 확인 없이도 다른 알림을 둘러볼 수 있는
  // 화살표. 세 가지 렌더 분기(이미지+텍스트/이미지 단독/텍스트 전용) 모두에서 재사용한다.
  const navArrows = queue.length > 1 && (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          goTo(index - 1);
        }}
        className="fixed z-[60] left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white text-xl leading-none"
        aria-label="이전 알림"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          goTo(index + 1);
        }}
        className="fixed z-[60] right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white text-xl leading-none"
        aria-label="다음 알림"
      >
        ›
      </button>
    </>
  );

  if (current.image_url) {
    // 알림 내용이 비어있으면 이미지+X 버튼만, 내용이 있으면 이미지와 함께 제목/내용도 보여준다.
    const hasText = !!current.message?.trim();
    return (
      <div
        className={`fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 transition-opacity duration-[250ms] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => dismiss()}
      >
        {navArrows}
        {hasText ? (
          <div
            className={`relative bg-surface rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl flex flex-col transition-transform duration-[250ms] ${
              visible ? "scale-100" : "scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => dismiss()}
              className="absolute z-10 top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white text-lg leading-none"
              aria-label="닫기"
            >
              ✕
            </button>
            <div className="bg-bg flex items-center justify-center">
              {current.link_url ? (
                <a
                  href={current.link_url}
                  target={current.link_url.startsWith("http") ? "_blank" : undefined}
                  rel={current.link_url.startsWith("http") ? "noopener noreferrer" : undefined}
                  onClick={hideToday}
                >
                  <img src={current.image_url} alt={current.title} className="max-w-full max-h-[45vh] object-contain cursor-pointer" />
                </a>
              ) : (
                <img src={current.image_url} alt={current.title} className="max-w-full max-h-[45vh] object-contain" />
              )}
            </div>
            <div className="p-5 overflow-y-auto">
              <div className={`text-xs font-bold tracking-widest uppercase mb-1 ${current.level === "urgent" ? "text-red" : "text-gold"}`}>
                {current.level === "urgent" ? "긴급 공지" : "공지"}
              </div>
              <h3 className="text-lg font-bold mb-2">{current.title}</h3>
              <p className="text-sm text-muted whitespace-pre-wrap mb-5">{current.message}</p>
              <div className="flex gap-2 justify-end flex-wrap">
                <button onClick={hideToday} className="border border-border text-sm rounded-lg px-4 py-2">
                  오늘 하루 안 보기
                </button>
                <button onClick={() => dismiss()} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
                  확인
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => dismiss()}
              className="absolute z-10 -top-3 -right-3 w-11 h-11 flex items-center justify-center rounded-full bg-navy text-white text-lg leading-none shadow-lg"
              aria-label="닫기"
            >
              ✕
            </button>
            {current.link_url ? (
              <a
                href={current.link_url}
                target={current.link_url.startsWith("http") ? "_blank" : undefined}
                rel={current.link_url.startsWith("http") ? "noopener noreferrer" : undefined}
                onClick={hideToday}
              >
                <img
                  src={current.image_url}
                  alt={current.title}
                  className={`max-w-[min(420px,85vw)] max-h-[min(420px,75vh)] object-contain rounded-lg shadow-2xl cursor-pointer transition-transform duration-[250ms] ${
                    visible ? "scale-100" : "scale-95"
                  }`}
                />
              </a>
            ) : (
              <img
                src={current.image_url}
                alt={current.title}
                className={`max-w-[min(420px,85vw)] max-h-[min(420px,75vh)] object-contain rounded-lg shadow-2xl transition-transform duration-[250ms] ${
                  visible ? "scale-100" : "scale-95"
                }`}
              />
            )}
            <div className="flex gap-2 bg-surface rounded-lg p-1.5 shadow-lg">
              <button onClick={hideToday} className="border border-border text-sm rounded-lg px-4 py-2">
                오늘 하루 안 보기
              </button>
              <button onClick={() => dismiss()} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
      {navArrows}
      <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-lg">
        <div className={`text-xs font-bold tracking-widest uppercase mb-1 ${current.level === "urgent" ? "text-red" : "text-gold"}`}>
          {current.level === "urgent" ? "긴급 공지" : "공지"}
        </div>
        <h3 className="text-lg font-bold mb-2">{current.title}</h3>
        <p className="text-sm text-muted whitespace-pre-wrap mb-5">{current.message}</p>
        <div className="flex gap-2 justify-end flex-wrap">
          <button onClick={hideToday} className="border border-border text-sm rounded-lg px-4 py-2">
            오늘 하루 안 보기
          </button>
          <button onClick={() => dismiss()} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
