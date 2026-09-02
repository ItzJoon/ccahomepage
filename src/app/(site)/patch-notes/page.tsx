"use client";

import Link from "next/link";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import type { PatchNote, PatchNoteItem, PatchNoteCategory } from "@/lib/types";

interface Row extends PatchNote {
  patch_note_items: PatchNoteItem[];
}

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

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function PatchNotesPage() {
  useTrackPageVisit("patch-notes");
  // RLS(patch_notes_read_published)가 is_published=true인 것만 비로그인 포함 누구에게나
  // 내려주므로 별도 필터 없이 그대로 목록으로 쓴다.
  const { rows } = useRealtimeList<Row>("patch_notes", {
    select: "*, patch_note_items(*)",
    orderBy: { column: "published_at", ascending: false },
  });

  return (
    <div>
      <SectionTitle eyebrow="PATCH NOTES" title="패치노트" />
      <div className="flex flex-col gap-4">
        {rows.map((n) => (
          <Link
            key={n.id}
            href={`/patch-notes/${n.id}`}
            className="block bg-white border border-border rounded-xl p-5 hover:border-blue transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {n.version && <span className="text-xs font-bold text-muted">{n.version}</span>}
              <h2 className="text-lg m-0 flex-1 min-w-0">{n.title}</h2>
              <span className="text-xs text-muted shrink-0">{fmt(n.published_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set(n.patch_note_items.flatMap((i) => i.categories))).map((c) => (
                <Badge key={c} color={CATEGORY_COLOR[c]}>{CATEGORY_LABEL[c]}</Badge>
              ))}
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="text-muted text-center py-8 text-sm">등록된 패치노트가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
