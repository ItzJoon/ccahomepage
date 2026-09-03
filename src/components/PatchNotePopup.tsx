"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import type { PatchNote, PatchNoteItem, PatchNoteCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<PatchNoteCategory, string> = {
  feature: "신규 기능",
  improvement: "개선",
  fix: "버그 수정",
};
const CATEGORY_COLOR: Record<PatchNoteCategory, string> = {
  feature: "teal",
  improvement: "gold",
  fix: "red",
};

interface NoteWithItems extends PatchNote {
  patch_note_items: PatchNoteItem[];
}

/**
 * 로그인한 사용자가 아직 확인하지 않은 최신 패치노트가 있으면 화면 가운데 모달로
 * 전체 내용을 바로 보여준다. layout.tsx가 서버에서 "아직 안 읽은 최신 게시글"을
 * 미리 조회해 initial로 내려주고, 여기서는 그걸 처음에 띄우는 것과, 이미 접속해 있는
 * 동안 새로 게시되는 경우를 실시간으로 잡아 추가로 보여주는 것 둘 다 담당한다.
 * 닫으면(X, 바깥 클릭, 확인) patch_note_reads에 기록해서 다시는 안 뜨게 한다.
 */
export default function PatchNotePopup({
  initial,
  userId,
}: {
  initial: NoteWithItems | null;
  userId: string | null;
}) {
  const [note, setNote] = useState<NoteWithItems | null>(initial);
  const noteRef = useRef<NoteWithItems | null>(note);
  noteRef.current = note;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("public:patch_notes:popup")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "patch_notes" },
        (payload) => {
          const n = payload.new as PatchNote;
          if (n.is_published) fetchAndShowIfUnread(supabase, userId, n.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patch_notes" },
        (payload) => {
          const n = payload.new as PatchNote;
          if (n.is_published) fetchAndShowIfUnread(supabase, userId, n.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // patch_note_items는 patch_notes와 별도로 저장돼서(관리자 화면이 저장할 때 항목을
  // 통째로 지웠다가 다시 넣는 방식) insert 이벤트가 뜬 직후 바로 조회하면 아직 항목이
  // 안 들어와 있을 수 있다 — 살짝 늦춰서 다시 조회한다.
  const fetchAndShowIfUnread = async (
    supabase: ReturnType<typeof createClient>,
    uid: string,
    patchNoteId: string
  ) => {
    if (noteRef.current?.id === patchNoteId) return;
    await new Promise((r) => setTimeout(r, 800));
    const { data: read } = await supabase
      .from("patch_note_reads")
      .select("patch_note_id")
      .eq("user_id", uid)
      .eq("patch_note_id", patchNoteId)
      .maybeSingle();
    if (read) return;
    const { data: fresh } = await supabase
      .from("patch_notes")
      .select("*, patch_note_items(*)")
      .eq("id", patchNoteId)
      .single();
    if (fresh) setNote(fresh as NoteWithItems);
  };

  // "확인"/닫기를 눌렀는데도 새로고침하면 같은 패치노트가 다시 뜨는 문제가 있었다 —
  // 원인은 이 함수가 insert 결과(error)를 전혀 확인하지 않아서, RLS 세션이 아직 완전히
  // 반영되지 않았거나 일시적인 네트워크 오류로 insert가 실패해도 화면에서는 조용히
  // 닫히고 아무 신호도 남지 않았던 것이다(patch_note_reads에 기록이 안 남으니 다음
  // 접속/새로고침 때 서버가 "안 읽음"으로 다시 판단해 팝업을 또 띄운다). 이제 결과를
  // 확인해서 실패하면 짧게 한 번 재시도하고, upsert + onConflict로 이미 기록돼 있는
  // 경우(중복 클릭 등)도 에러 없이 안전하게 처리한다.
  const markRead = async (uid: string, patchNoteId: string) => {
    const supabase = createClient();
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await supabase
        .from("patch_note_reads")
        .upsert({ user_id: uid, patch_note_id: patchNoteId }, { onConflict: "user_id,patch_note_id", ignoreDuplicates: true });
      if (!error) return;
      console.error("patch_note_reads 기록 실패, 재시도", attempt, error);
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  const close = async () => {
    if (!note || !userId) {
      setNote(null);
      return;
    }
    const patchNoteId = note.id;
    setNote(null);
    await markRead(userId, patchNoteId);
  };

  if (!note || !userId) return null;

  const items = [...note.patch_note_items].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={close}>
      <div
        className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-xs font-bold tracking-widest uppercase text-gold">새로운 업데이트</div>
          <button onClick={close} className="text-muted text-xl leading-none shrink-0" aria-label="닫기">✕</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {note.version && <span className="text-sm font-bold text-muted">{note.version}</span>}
          <h3 className="text-lg font-bold m-0 min-w-0">{note.title}</h3>
        </div>
        <ul className="list-none m-0 p-0 flex flex-col gap-2.5 mb-5">
          {items.map((i) => (
            <li key={i.id} className="flex items-start gap-2">
              <div className="flex gap-1 shrink-0 mt-0.5">
                {i.categories.map((c) => (
                  <Badge key={c} color={CATEGORY_COLOR[c]}>{CATEGORY_LABEL[c]}</Badge>
                ))}
              </div>
              <p className="text-sm whitespace-pre-wrap m-0">
                <Linkify text={i.content} />
              </p>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 justify-end flex-wrap">
          <Link href="/patch-notes" onClick={close} className="border border-border text-sm rounded-lg px-4 py-2">
            전체 패치노트 보기
          </Link>
          <button onClick={close} className="bg-navy text-white font-bold text-sm rounded-lg px-4 py-2">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
