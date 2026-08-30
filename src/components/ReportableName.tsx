"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 게시판 등에서 다른 사람의 닉네임을 눌렀을 때 뜨는 작은 메뉴(헤더의 "{이름} ▾" 프로필
 * 드롭다운과 같은 UI 패턴) — 지금은 "신고" 한 항목뿐이다. 닉네임 옆에 별도 버튼을
 * 두지 않고 닉네임 자체를 누르면 뜨도록 요청받았다.
 */
export default function ReportableName({
  targetUserId,
  name,
  myId,
  context,
  className,
}: {
  targetUserId: string;
  name: string;
  myId: string | null;
  context?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setReporting(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // 본인 이름은 신고 메뉴를 띄울 필요가 없다.
  if (myId && myId === targetUserId) {
    return <span className={className}>{name}</span>;
  }

  const submitReport = async () => {
    if (!myId) return;
    await createClient().from("reports").insert({
      reporter_id: myId,
      target_type: "profile",
      target_id: targetUserId,
      context: context ?? null,
      reason: reason.trim() || null,
    });
    setDone(true);
    setReason("");
    setTimeout(() => {
      setDone(false);
      setReporting(false);
      setOpen(false);
    }, 1200);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={className}>
        {name} ▾
      </button>
      {open && !reporting && (
        <div className="absolute left-0 top-full mt-1 w-32 py-1.5 z-30 bg-white border border-border rounded-lg shadow-md">
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="block w-full text-left px-3 py-1.5 text-xs text-red font-bold hover:bg-[#FDEBEC]"
          >
            신고
          </button>
        </div>
      )}
      {open && reporting && (
        <div className="absolute left-0 top-full mt-1 w-60 p-3 z-30 bg-white border border-border rounded-lg shadow-md flex flex-col gap-1.5">
          {done ? (
            <p className="text-xs text-teal font-bold m-0">신고가 접수되었습니다.</p>
          ) : (
            <>
              <p className="text-xs font-bold m-0">{name}님 신고</p>
              <textarea
                rows={2}
                className="border border-border rounded-lg px-2 py-1.5 text-xs"
                placeholder="신고 사유 (선택)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-1.5">
                <button type="button" onClick={submitReport} className="bg-red text-white text-xs font-bold rounded-lg px-2.5 py-1">
                  신고하기
                </button>
                <button type="button" onClick={() => setReporting(false)} className="border border-border text-xs rounded-lg px-2.5 py-1">
                  취소
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
