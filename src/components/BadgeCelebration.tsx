import type { BadgeDef } from "@/lib/types";

export default function BadgeCelebration({ badge, onClose }: { badge: BadgeDef; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-6xl mb-3">{badge.icon}</div>
        <div className="text-xs font-bold tracking-widest text-gold uppercase mb-1">NEW BADGE</div>
        <h3 className="text-xl font-black mb-1">{badge.label}</h3>
        <p className="text-muted text-sm mb-5">{badge.description}</p>
        <button onClick={onClose} className="bg-navy text-white font-bold text-sm rounded-lg px-5 py-2.5">
          확인
        </button>
      </div>
    </div>
  );
}
