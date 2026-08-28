import type { BadgeDef } from "@/lib/types";

export default function BadgeCelebration({ badge, onClose }: { badge: BadgeDef; onClose: () => void }) {
  const secret = badge.is_secret;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`rounded-2xl p-8 text-center max-w-sm w-full ${
          secret ? "bg-gradient-to-b from-[#FFF8E6] to-white border-2 border-gold shadow-[0_0_40px_rgba(212,160,23,0.35)]" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`text-6xl mb-3 ${secret ? "animate-bounce" : ""}`}>{badge.icon}</div>
        <div className={`text-xs font-bold tracking-widest uppercase mb-1 ${secret ? "text-gold" : "text-gold"}`}>
          {secret ? "✨ SECRET BADGE ✨" : "NEW BADGE"}
        </div>
        <h3 className="text-xl font-black mb-1">{badge.label}</h3>
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
