"use client";

import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import type { MainBlock } from "@/lib/types";

export default function AdminMainEditorPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<MainBlock>("main_blocks", { orderBy: { column: "order_index" } });

  const toggle = async (b: MainBlock) => {
    await supabase.from("main_blocks").update({ is_visible: !b.is_visible }).eq("id", b.id);
    reload();
  };

  const move = async (b: MainBlock, dir: number) => {
    const sorted = [...rows].sort((a, b2) => a.order_index - b2.order_index);
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
        학생용 홈에 노출할 블록을 선택하고 순서를 조정하세요. 변경 사항은 Realtime을 통해 즉시 학생 화면에 반영됩니다.
      </p>
      <ul className="list-none m-0 p-0 max-w-md">
        {[...rows].sort((a, b) => a.order_index - b.order_index).map((b) => (
          <li key={b.id} className="border-b border-border py-2.5 flex items-center gap-2">
            <label className="flex items-center gap-2 flex-1 text-sm">
              <input type="checkbox" checked={b.is_visible} onChange={() => toggle(b)} /> {b.label}
            </label>
            <button className="text-blue text-xs font-bold" onClick={() => move(b, -1)}>▲</button>
            <button className="text-blue text-xs font-bold" onClick={() => move(b, 1)}>▼</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
