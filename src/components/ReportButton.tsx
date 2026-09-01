"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 게시글/댓글처럼 "그 사람"이 아니라 "그 글/댓글 자체"를 신고할 때 쓰는 버튼.
 * ReportableName(닉네임 클릭 신고)은 항상 target_type="profile"로 사람을 신고하는
 * 반면, 이건 target_type을 "board_post"/"board_comment"로 남겨서 관리자 신고
 * 내역 화면에서 그 글/댓글 내용을 바로 보고 숨김·삭제할 수 있게 한다.
 */
export default function ReportButton({
  targetType,
  targetId,
  authorId,
  myId,
  context,
}: {
  targetType: "board_post" | "board_comment";
  targetId: string;
  authorId: string | null;
  myId: string | null;
  context?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // 로그인 안 했거나 본인 글/댓글이면 신고 버튼 자체를 보여줄 이유가 없다.
  if (!myId || myId === authorId) return null;

  const submitReport = async () => {
    await createClient().from("reports").insert({
      reporter_id: myId,
      target_type: targetType,
      target_id: targetId,
      context: context ?? null,
      reason: reason.trim() || null,
    });
    setDone(true);
    setReason("");
    setTimeout(() => {
      setDone(false);
      setOpen(false);
    }, 1200);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-muted text-xs font-bold hover:text-red">
        신고
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 p-3 z-30 bg-white border border-border rounded-lg shadow-md flex flex-col gap-1.5">
          {done ? (
            <p className="text-xs text-teal font-bold m-0">신고가 접수되었습니다.</p>
          ) : (
            <>
              <p className="text-xs font-bold m-0">{targetType === "board_post" ? "이 글 신고" : "이 댓글 신고"}</p>
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
                <button type="button" onClick={() => setOpen(false)} className="border border-border text-xs rounded-lg px-2.5 py-1">
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
