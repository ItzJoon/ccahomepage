"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GROUP_SIZES = [4, 4, 4];
const LENGTH = GROUP_SIZES.reduce((a, b) => a + b, 0);

function sanitizeChar(raw: string) {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(-1); // 조합 입력 등으로 여러 글자가 한 번에 들어와도 마지막 한 글자만 쓴다
}

/**
 * 뱃지 코드 입력 모달. 성공 시 badge_code_redemptions에 사용 기록을 남기고 user_badges에
 * 뱃지를 지급하는 redeem_badge_code RPC만 호출하고, 실제 축하 팝업(효과음 포함)은 이미
 * (site)/layout.tsx에 마운트된 BadgeGrantWatcher가 user_badges INSERT를 감지해서 띄운다 —
 * 여기서 직접 축하 연출을 만들지 않고 기존 경로를 그대로 재사용한다.
 *
 * 입력칸을 한 줄짜리 텍스트 입력 + placeholder 문자열이 아니라 글자 수만큼(12칸)
 * 나눠진 개별 입력칸으로 만든다 — 한 칸짜리 입력은 항상 그 칸의 맨 앞(유일한 자리)에
 * 커서가 있어서 "가운데서부터 채워지는" 것처럼 보이는 문제 자체가 없고, 아직 입력 안 된
 * 칸은 그 칸의 placeholder("X")가 계속 회색으로 보이며, 입력/백스페이스마다 다음/이전
 * 칸으로 커서를 정확히 옮길 수 있다.
 */
export default function CodeRedeemModal({
  onClose,
  onRedeemed,
  description,
}: {
  onClose: () => void;
  onRedeemed: () => void;
  /** 이 모달은 뱃지 외 다른 용도(이벤트 쿠폰, 권한 부여 등)로도 재사용할 수 있도록
   * 설명 문구를 필수로 박아두지 않는다 — 필요할 때만 호출부에서 넘긴다. */
  description?: string;
}) {
  const supabase = createClient();
  const [chars, setChars] = useState<string[]>(Array(LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isComplete = chars.every((c) => c !== "");
  const formattedCode = [
    chars.slice(0, 4).join(""),
    chars.slice(4, 8).join(""),
    chars.slice(8, 12).join(""),
  ].join("-");

  const setCharAt = (idx: number, value: string) => {
    setChars((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleChange = (idx: number, raw: string) => {
    const ch = sanitizeChar(raw);
    setCharAt(idx, ch);
    if (ch && idx < LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (isComplete) submit();
      return;
    }
    // 현재 칸이 비어있는 상태에서 백스페이스를 누르면 이전 칸으로 이동해서 그 칸을 지운다
    // (칸에 글자가 남아있을 때의 첫 백스페이스는 그 칸만 지우고 그대로 머무른다 — 브라우저
    // 기본 동작으로 이미 처리됨).
    if (e.key === "Backspace" && chars[idx] === "" && idx > 0) {
      e.preventDefault();
      setCharAt(idx - 1, "");
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LENGTH);
    if (!text) return;
    const next = Array(LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setChars(next);
    inputRefs.current[Math.min(text.length, LENGTH - 1)]?.focus();
  };

  const submit = async () => {
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.rpc("redeem_badge_code", { p_code: formattedCode });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    onRedeemed();
  };

  let flatIndex = 0;

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
            {description && <p className="text-muted text-xs mb-3">{description}</p>}
            <div className={`flex items-center justify-center gap-1.5 ${description ? "" : "mt-3"}`}>
              {GROUP_SIZES.map((size, groupIdx) => (
                <div key={groupIdx} className="flex items-center gap-1">
                  {groupIdx > 0 && <span className="text-muted font-bold mx-0.5">-</span>}
                  {Array.from({ length: size }).map(() => {
                    const idx = flatIndex++;
                    return (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        value={chars[idx]}
                        placeholder="X"
                        onChange={(e) => handleChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        onPaste={handlePaste}
                        maxLength={1}
                        inputMode="text"
                        autoFocus={idx === 0}
                        className="w-8 h-10 text-center font-mono text-lg font-bold border border-border rounded-md bg-transparent placeholder:text-muted placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue"
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            {error && <p className="text-red text-xs mt-2 text-center">{error}</p>}
            <button
              onClick={submit}
              disabled={submitting || !isComplete}
              className="w-full bg-navy text-white font-bold text-sm rounded-lg px-5 py-2.5 mt-4 disabled:opacity-40"
            >
              {submitting ? "확인 중…" : "확인"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
