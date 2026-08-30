"use client";

import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { MainBlock } from "@/lib/types";

const WIDTH_OPTIONS = [
  { value: 1, label: "1/3 너비" },
  { value: 2, label: "2/3 너비" },
  { value: 3, label: "전체 너비" },
];

// 이 미리보기는 화면 폭과 무관하게 항상 3칸으로 고정해서 보여주므로(반응형 아님),
// HomeContent.tsx의 md: 접두어 버전과 달리 접두어 없는 완성된 클래스 문자열을 쓴다
// (Tailwind JIT은 동적으로 이어붙인 클래스 이름을 인식하지 못한다).
const COL_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
};

export default function AdminMainEditorPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<MainBlock>("main_blocks", { orderBy: { column: "order_index" } });
  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  const visiblePreview = sorted.filter((b) => b.is_visible);

  const toggle = async (b: MainBlock) => {
    await supabase.from("main_blocks").update({ is_visible: !b.is_visible }).eq("id", b.id);
    reload();
  };

  const changeWidth = async (b: MainBlock, col_span: number) => {
    await supabase.from("main_blocks").update({ col_span }).eq("id", b.id);
    reload();
  };

  const move = async (b: MainBlock, dir: number) => {
    const idx = sorted.findIndex((x) => x.id === b.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("main_blocks").update({ order_index: swap.order_index }).eq("id", b.id),
      supabase.from("main_blocks").update({ order_index: b.order_index }).eq("id", swap.id),
    ]);
    reload();
  };

  return (
    <div>
      <h2 className="text-[22px] mb-2">메인 화면 편집기</h2>
      <p className="text-muted mb-4">
        학생용 홈에 노출할 블록을 선택하고, 순서와 너비(1/3·2/3·전체)를 조정하세요. 3칸 기준
        그리드라 너비를 조합하면 한 줄에 최대 3개까지 나란히 배치할 수 있습니다. 변경 사항은
        Realtime을 통해 즉시 학생 화면에 반영됩니다.
      </p>
      <ul className="list-none m-0 p-0 max-w-xl mb-6">
        {sorted.map((b) => (
          <li key={b.id} className="border-b border-border py-2.5 flex items-center gap-2">
            <label className="flex items-center gap-2 flex-1 text-sm">
              <input type="checkbox" checked={b.is_visible} onChange={() => toggle(b)} /> {b.label}
            </label>
            <select
              className="border border-border rounded-lg px-2 py-1 text-xs"
              value={b.col_span}
              onChange={(e) => changeWidth(b, Number(e.target.value))}
            >
              {WIDTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button className="text-blue text-xs font-bold" onClick={() => move(b, -1)}>▲</button>
            <button className="text-blue text-xs font-bold" onClick={() => move(b, 1)}>▼</button>
          </li>
        ))}
      </ul>

      <h3 className="text-base font-bold mb-2">미리보기</h3>
      <div className="grid grid-cols-3 gap-2.5 max-w-xl">
        {visiblePreview.map((b) => (
          <div
            key={b.id}
            className={`${COL_SPAN_CLASS[b.col_span] ?? COL_SPAN_CLASS[3]} bg-[#EAF0FB] border border-dashed border-blue rounded-lg p-3 text-xs font-bold text-center text-blue`}
          >
            {b.label}
          </div>
        ))}
        {visiblePreview.length === 0 && (
          <div className="col-span-3 text-muted text-center py-6 text-sm">표시할 블록이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
