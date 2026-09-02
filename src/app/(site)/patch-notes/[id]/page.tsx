import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import DetailBackLink from "@/components/DetailBackLink";
import type { PatchNoteCategory, PatchNoteItem } from "@/lib/types";

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

export default async function PatchNoteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: note } = await supabase.from("patch_notes").select("*, patch_note_items(*)").eq("id", params.id).single();
  if (!note) {
    return <div className="text-muted text-center py-10">패치노트를 찾을 수 없습니다.</div>;
  }

  // 항목 하나가 여러 카테고리에 동시에 속할 수 있어서(예: 신규 기능+버그 수정), 카테고리별
  // 섹션으로 나누지 않고 항목마다 해당하는 뱃지를 전부 붙여서 한 번씩만 보여준다.
  const items = (note.patch_note_items as PatchNoteItem[]).sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <DetailBackLink href="/patch-notes" label="패치노트로" />
      <div className="flex items-center gap-2 flex-wrap my-2">
        {note.version && <span className="text-sm font-bold text-muted">{note.version}</span>}
        <h1 className="text-2xl m-0 min-w-0">{note.title}</h1>
      </div>
      <div className="text-muted text-sm mb-[18px]">{fmt(note.published_at)}</div>
      <ul className="list-none m-0 p-0 flex flex-col gap-3">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-2">
            <div className="flex gap-1 shrink-0 mt-0.5">
              {i.categories.map((c) => (
                <Badge key={c} color={CATEGORY_COLOR[c]}>{CATEGORY_LABEL[c]}</Badge>
              ))}
            </div>
            <p className="text-[15px] leading-7 whitespace-pre-wrap m-0">
              <Linkify text={i.content} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
