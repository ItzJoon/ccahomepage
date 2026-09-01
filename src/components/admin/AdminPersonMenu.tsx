"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProfileQuickEditModal from "@/components/ProfileQuickEditModal";
import ModerationPanel from "@/components/admin/ModerationPanel";

/**
 * 관리자 화면(Q&A 관리 등)에서 다른 사람 이름을 눌렀을 때 뜨는 관리자 전용 메뉴 —
 * "닉네임·소개 수정"과 "제재 조치"(경고/정지/영구차단, ModerationPanel 재사용)를
 * 그 자리에서 바로 할 수 있게 한다. 공개 화면의 ReportableName(프로필 보기/신고 중심)과는
 * 목적이 달라 별도 컴포넌트로 뒀다 — 여긴 이미 관리자 화면이라 "신고"가 필요 없고,
 * 대신 조치 기능이 필요하다.
 */
export default function AdminPersonMenu({
  userId,
  name,
  maxWidthClass = "max-w-[140px]",
}: {
  userId: string;
  name: string;
  maxWidthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<{ nickname: string; bio: string } | null>(null);
  const [moderating, setModerating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const startEdit = async () => {
    setOpen(false);
    const { data } = await createClient().from("profiles").select("nickname, bio").eq("id", userId).single();
    setEditTarget({ nickname: data?.nickname ?? "", bio: data?.bio ?? "" });
    setEditing(true);
  };

  return (
    <div className="relative inline-flex max-w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={name}
        className="inline-flex items-center gap-0.5 max-w-full"
      >
        <span className={`truncate ${maxWidthClass}`}>{name}</span>
        <span className="shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-36 py-1.5 z-30 bg-white border border-border rounded-lg shadow-md">
          <button type="button" onClick={startEdit} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-bg">
            닉네임·소개 수정
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setModerating(true);
            }}
            className="block w-full text-left px-3 py-1.5 text-xs text-red font-bold hover:bg-[#FDEBEC]"
          >
            제재 조치
          </button>
        </div>
      )}
      {editing && editTarget && (
        <ProfileQuickEditModal
          userId={userId}
          initialNickname={editTarget.nickname}
          initialBio={editTarget.bio}
          onClose={() => {
            setEditing(false);
            setEditTarget(null);
          }}
        />
      )}
      {moderating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModerating(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold m-0">{name} 제재 조치</h3>
              <button type="button" onClick={() => setModerating(false)} className="text-muted text-xl leading-none">
                ✕
              </button>
            </div>
            <ModerationPanel targetUserId={userId} />
          </div>
        </div>
      )}
    </div>
  );
}
