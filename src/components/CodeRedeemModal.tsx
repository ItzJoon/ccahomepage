"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** 입력값을 XXXX-XXXX-XXXX 형식으로 강제한다 — 영문 소문자는 대문자로, 하이픈 이외의
 * 구분자나 공백은 제거하고, 4글자마다 자동으로 하이픈을 붙인다. */
function formatCodeInput(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12)].filter(Boolean).join("-");
}

/**
 * 뱃지 코드 입력 모달. 성공 시 badge_code_redemptions에 사용 기록을 남기고 user_badges에
 * 뱃지를 지급하는 redeem_badge_code RPC만 호출하고, 실제 축하 팝업(효과음 포함)은 이미
 * (site)/layout.tsx에 마운트된 BadgeGrantWatcher가 user_badges INSERT를 감지해서 띄운다 —
 * 여기서 직접 축하 연출을 만들지 않고 기존 경로를 그대로 재사용한다.
 */
export default function CodeRedeemModal({ onClose, onRedeemed }: { onClose: () => void; onRedeemed: () => void }) {
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (code.length < 14 || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.rpc("redeem_badge_code", { p_code: code });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    onRedeemed();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="text-center flex flex-col items-center gap-3 py-4">
            <div className="text-5xl">🎉</div>
            <p className="font-bold">뱃지를 획득했습니다!</p>
            <button onClick={onClose} className="text-blue font-bold text-sm">
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="m-0">코드 입력</h3>
              <button onClick={onClose} className="text-muted text-xl leading-none shrink-0">
                ✕
              </button>
            </div>
            <p className="text-muted text-xs mb-3">뱃지 코드를 입력하면 즉시 뱃지를 획득합니다.</p>
            <input
              className="w-full border border-border rounded-lg px-3 py-2.5 text-center font-mono text-lg tracking-widest bg-transparent"
              placeholder="XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(formatCodeInput(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={14}
              autoFocus
            />
            {error && <p className="text-red text-xs mt-2">{error}</p>}
            <button
              onClick={submit}
              disabled={submitting || code.length < 14}
              className="w-full bg-navy text-white font-bold text-sm rounded-lg px-5 py-2.5 mt-3 disabled:opacity-40"
            >
              {submitting ? "확인 중…" : "확인"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
