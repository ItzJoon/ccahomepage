import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/Badge";
import Linkify from "@/components/Linkify";
import DetailBackLink from "@/components/DetailBackLink";
import type { PatchNoteCategory } from "@/lib/types";

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

  const itemsByCategory = (Object.keys(CATEGORY_LABEL) as PatchNoteCategory[])
    .map((category) => ({
      category,
      items: (note.patch_note_items as { id: string; category: PatchNoteCategory; content: string; order_index: number }[])
        .filter((i) => i.category === category)
        .sort((a, b) => a.order_index - b.order_index),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="bg-white border border-border rounded-2xl p-7">
      <DetailBackLink href="/patch-notes" label="패치노트로" />
      <div className="flex items-center gap-2 flex-wrap my-2">
        {note.version && <span className="text-sm font-bold text-muted">{note.version}</span>}
        <h1 className="text-2xl m-0 min-w-0">{note.title}</h1>
      </div>
      <div className="text-muted text-sm mb-[18px]">{fmt(note.published_at)}</div>
      <div className="flex flex-col gap-5">
        {itemsByCategory.map((g) => (
          <div key={g.category}>
            <Badge color={CATEGORY_COLOR[g.category]} className="mb-2">{CATEGORY_LABEL[g.category]}</Badge>
            <ul className="list-disc pl-5 m-0 flex flex-col gap-1.5">
              {g.items.map((i) => (
                <li key={i.id} className="text-[15px] leading-7 whitespace-pre-wrap">
                  <Linkify text={i.content} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
