"use client";

import { useEffect, useMemo } from "react";
import type { BadgeDef } from "@/lib/types";
import { playBadgeSound } from "@/lib/badgeSound";

const CONFETTI_CHARS = ["✨", "🎉", "⭐", "🌟", "💫"];

export default function BadgeCelebration({
  badge,
  onClose,
  soundEnabled = true,
}: {
  badge: BadgeDef;
  onClose: () => void;
  soundEnabled?: boolean;
}) {
  const secret = badge.secret_tier !== "none";
  const superSecret = badge.secret_tier === "super_secret";

  useEffect(() => {
    if (soundEnabled) playBadgeSound(badge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge.id]);

  // 슈퍼시크릿일 때만 색종이 조각을 흩뿌린다 — 매 렌더마다 위치가 바뀌면 안 되므로
  // badge.id가 바뀔 때만(즉 새 뱃지를 보여줄 때만) 다시 뽑는다.
  const confetti = useMemo(() => {
    if (!superSecret) return [];
    return Array.from({ length: 24 }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.4 + Math.random() * 0.8,
      char: CONFETTI_CHARS[i % CONFETTI_CHARS.length],
      size: 14 + Math.random() * 14,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge.id, superSecret]);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 p-4 overflow-hidden ${
        superSecret ? "bg-black/70" : "bg-black/50"
      }`}
      onClick={superSecret ? undefined : onClose}
    >
      {superSecret &&
        confetti.map((c) => (
          <span
            key={c.key}
            className="absolute top-0 animate-confetti-fall pointer-events-none select-none"
            style={{
              left: `${c.left}%`,
              fontSize: `${c.size}px`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          >
            {c.char}
          </span>
        ))}
      <div
        className={`rounded-2xl text-center w-full ${
          superSecret
            ? "p-10 max-w-md bg-gradient-to-b from-[#FFF8E6] to-white border-2 border-gold animate-glow-pulse"
            : secret
            ? "p-8 max-w-sm bg-gradient-to-b from-[#FFF8E6] to-white border-2 border-gold shadow-[0_0_40px_rgba(212,160,23,0.35)]"
            : "p-8 max-w-sm bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mb-3 ${superSecret ? "text-8xl animate-bounce" : secret ? "text-6xl animate-bounce" : "text-6xl"}`}>
          {badge.icon}
        </div>
        <div className="text-xs font-bold tracking-widest uppercase mb-1 text-gold">
          {superSecret ? "🌟 SUPER SECRET BADGE 🌟" : secret ? "✨ SECRET BADGE ✨" : "NEW BADGE"}
        </div>
        <h3 className={`font-black mb-1 ${superSecret ? "text-2xl" : "text-xl"}`}>{badge.label}</h3>
        <p className="text-muted text-sm mb-5">{badge.description}</p>
        <button
          onClick={onClose}
          className={`font-bold text-sm rounded-lg px-5 py-2.5 text-white ${secret ? "bg-gold" : "bg-navy"}`}
        >
          확인
        </button>
      </div>
    </div>
  );
}
