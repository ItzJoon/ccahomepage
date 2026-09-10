"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKST } from "@/lib/date";
import { playAttachedSound } from "@/lib/notificationSound";
import type { NotificationItem } from "@/lib/types";

function isHiddenToday(id: string) {
  return localStorage.getItem(`notif_hide_${id}`) === todayKST();
}

/** display_until이 없으면 계속 표시(무기한), 있으면 그 시각이 지나면 만료 처리 */
function isExpired(n: NotificationItem) {
  if (!n.display_until) return false;
  return Date.now() > new Date(n.display_until).getTime();
}

function isQueueable(n: NotificationItem) {
  return n.popup_active && !isExpired(n) && !isHiddenToday(n.id);
}

/**
 * display_type이 'popup'인 알림을 페이지 진입 시 모달로 띄웁니다.
 * 배너와 달리 학생이 "확인" 또는 "오늘 하루 안 보기"를 눌러야 사라집니다.
 * "오늘 하루 안 보기"는 이 브라우저(localStorage)에만 저장되어, 같은 학생이라도
 * 다른 기기/브라우저에서는 다시 뜹니다.
 *
 * 동시에 여러 개가 활성화돼 있으면(예: 관리자가 팝업 3개를 켜둔 상태) 전부 큐에
 * 담아뒀다가 한 번에 하나씩만 보여주고, 확인/오늘 하루 안 보기/ESC로 닫을 때마다
 * 큐 맨 앞을 비우고 다음 것을 보여준다. 새로 들어오는 알림(realtime INSERT)은
 * 지금 보고 있는 걸 밀어내지 않고 큐 맨 뒤에 붙는다.
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
}: {
  initial: NotificationItem[];
  soundEnabled?: boolean;
}) {
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const [visible, setVisible] = useState(false);
  const current = queue[0] ?? null;

  useEffect(() => {
    setQueue(initial.filter(isQueueable));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // 지금 보여주고 있는 걸 큐에서 빼고 다음 걸로 넘어간다(확인/오늘 하루 안 보기/ESC 공용).
  const dismiss = () => setQueue((q) => q.slice(1));

  const hideToday = () => {
    if (!current) return;
    localStorage.setItem(`notif_hide_${current.id}`, todayKST());
    dismiss();
  };

  // 팝업이 새로 뜨는 시점에 첨부된 사운드를 한 번 재생한다(마이페이지에서 꺼뒀으면 생략).
  useEffect(() => {
    if (current && soundEnabled) playAttachedSound(current.sound_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("public:notifications:popup")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as NotificationItem;
          if (n.display_type === "popup" && isQueueable(n)) {
            setQueue((q) => (q.some((x) => x.id === n.id) ? q : [...q, n]));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as NotificationItem;
          setQueue((q) => (!n.popup_active || isExpired(n) ? q.filter((x) => x.id !== n.id) : q.map((x) => (x.id === n.id ? n : x))));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          const old = payload.old as { id: string };
          setQueue((q) => q.filter((x) => x.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 노출 종료 시각이 정해진 팝업이면, 페이지를 계속 열어둔 사이 그 시각이 지나는 순간
  // 자동으로 닫고 다음 걸로 넘어간다(배너와 동일한 패턴).
  useEffect(() => {
    if (!current || !current.display_until) return;
    const remaining = new Date(current.display_until).getTime() - Date.now();
    if (remaining <= 0) {
      dismiss();
      return;
    }
    const timer = setTimeout(dismiss, remaining);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              className="absolute z-10 top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white text-lg leading-none"
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
              className="absolute z-10 -top-3 -right-3 w-9 h-9 flex items-center justify-center rounded-full bg-navy text-white text-lg leading-none shadow-lg"
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
