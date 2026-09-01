"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ProfileQuickEditModal from "@/components/ProfileQuickEditModal";

/**
 * 게시판 등에서 다른 사람의 닉네임을 눌렀을 때 뜨는 작은 메뉴(헤더의 "{이름} ▾" 프로필
 * 드롭다운과 같은 UI 패턴) — "프로필 보기"/"신고", admin 이상이면 "닉네임·소개 수정"까지.
 * 닉네임 옆에 별도 버튼을 두지 않고 닉네임 자체를 누르면 뜨도록 요청받았다. 여기 표시되는
 * 이름은 항상 작성자가 공개하기로 한(또는 원래 공개인) 경우에만 호출하는 쪽에서
 * 렌더링하므로, 프로필 링크를 추가해도 익명 게시물의 작성자를 드러내는 문제는 없다.
 *
 * canEditProfile은 호출하는 쪽(페이지)에서 한 번만 role을 조회해 넘겨준다 — 목록에
 * 이 컴포넌트가 여러 개(댓글마다 등) 있을 수 있어서, 각 인스턴스가 각자 role을
 * 조회하면 같은 조회가 중복된다.
 */
export default function ReportableName({
  targetUserId,
  name,
  myId,
  context,
  className,
  canEditProfile,
  maxWidthClass = "max-w-[120px]",
}: {
  targetUserId: string;
  name: string;
  myId: string | null;
  context?: string;
  className?: string;
  canEditProfile?: boolean;
  /** 닉네임이 길 때 말줄임 처리할 최대 너비(Tailwind 클래스) — 쓰는 화면의 칸 폭에 맞게 조정 가능. */
  maxWidthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<{ nickname: string; bio: string } | null>(null);
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
    return (
      <span className={`inline-block truncate align-bottom ${maxWidthClass} ${className ?? ""}`} title={name}>
        {name}
      </span>
    );
  }

  const startEdit = async () => {
    setOpen(false);
    const { data } = await createClient().from("profiles").select("nickname, bio").eq("id", targetUserId).single();
    setEditTarget({ nickname: data?.nickname ?? "", bio: data?.bio ?? "" });
    setEditing(true);
  };

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
    <div className="relative inline-flex max-w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={name}
        className={`inline-flex items-center gap-0.5 max-w-full ${className ?? ""}`}
      >
        <span className={`truncate ${maxWidthClass}`}>{name}</span>
        <span className="shrink-0">▾</span>
      </button>
      {open && !reporting && (
        <div className="absolute left-0 top-full mt-1 w-32 py-1.5 z-30 bg-white border border-border rounded-lg shadow-md">
          <Link
            href={`/members/${targetUserId}`}
            onClick={() => setOpen(false)}
            className="block w-full text-left px-3 py-1.5 text-xs hover:bg-bg"
          >
            프로필 보기
          </Link>
          {canEditProfile && (
            <button
              type="button"
              onClick={startEdit}
              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-bg"
            >
              닉네임·소개 수정
            </button>
          )}
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
      {editing && editTarget && (
        <ProfileQuickEditModal
          userId={targetUserId}
          initialNickname={editTarget.nickname}
          initialBio={editTarget.bio}
          onClose={() => {
            setEditing(false);
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
