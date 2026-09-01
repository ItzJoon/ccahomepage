"use client";

import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { MainBlock } from "@/lib/types";

// 6칸 기준 그리드다(2와 3의 최소공배수) — 1/3과 2/3뿐 아니라 1/2도 정수 칸 수로
// 표현하기 위해서다(3칸 기준이면 1/2가 1.5칸이 되어 표현할 수 없었다).
const HALF_WIDTH = 3;
const WIDTH_OPTIONS = [
  { value: 2, label: "1/3 너비" },
  { value: HALF_WIDTH, label: "1/2 너비" },
  { value: 4, label: "2/3 너비" },
  { value: 6, label: "전체 너비" },
];

// 이 미리보기는 화면 폭과 무관하게 항상 6칸으로 고정해서 보여주므로(반응형 아님),
// HomeContent.tsx의 md: 접두어 버전과 달리 접두어 없는 완성된 클래스 문자열을 쓴다
// (Tailwind JIT은 동적으로 이어붙인 클래스 이름을 인식하지 못한다).
const COL_SPAN_CLASS: Record<number, string> = {
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  6: "col-span-6",
};

export default function AdminMainEditorPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<MainBlock>("main_blocks", { orderBy: { column: "order_index" } });
  const { t } = useHomeTheme();
  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  const visiblePreview = sorted.filter((b) => b.is_visible);

  const toggle = async (b: MainBlock) => {
    await supabase.from("main_blocks").update({ is_visible: !b.is_visible }).eq("id", b.id);
    reload();
  };

  // 이전엔 1/2 너비 블록의 바로 다음에도 1/2 너비만 오도록 강제하고 어기면 alert로 막았는데,
  // CSS 그리드가 이미 한 줄에 남은 칸이 모자라면 자동으로 다음 줄로 넘겨주므로(grid-auto-flow
  // 기본 동작) 그 제약을 없애고 짝이 안 맞으면 그냥 자동 줄바꿈되게 둔다.
  const changeWidth = async (b: MainBlock, col_span: number) => {
    await supabase.from("main_blocks").update({ col_span }).eq("id", b.id);
    reload();
  };

  // 입력할 때마다 저장하면 숫자를 한 자리씩 지울 때도 계속 DB에 쓰기가 발생하므로, 다른
  // 숫자 입력(예: 신고 제재 기준)과 같은 방식으로 포커스를 벗어날 때만 저장한다.
  const changeHeight = async (b: MainBlock, value: string) => {
    const height_px = value.trim() === "" ? null : Number(value);
    await supabase.from("main_blocks").update({ height_px }).eq("id", b.id);
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
        학생용 홈에 노출할 블록을 선택하고, 순서·너비(1/3·1/2·2/3·전체)·높이를 조정하세요.
        6칸 기준 그리드라 너비를 조합하면 한 줄을 꽉 채울 수 있고, 한 줄에 다 들어가지
        않으면 자동으로 다음 줄로 넘어갑니다. 높이는 비워두면 내용에 맞게 자동으로 정해지고,
        값을 넣으면 그 픽셀 이상으로 늘어납니다(급식표처럼 이미지가 있는 블록은 그 안에서
        스크롤됩니다). 변경 사항은 Realtime을 통해 즉시 학생 화면에 반영됩니다.
      </p>
      <ul className="list-none m-0 p-0 max-w-xl mb-6">
        {sorted.map((b) => (
          <li key={b.id} className="border-b border-border py-2.5 flex items-center gap-2">
            <label className="flex items-center gap-2 flex-1 text-sm">
              <input type="checkbox" checked={b.is_visible} onChange={() => toggle(b)} /> {b.label}
            </label>
            <select
              className={`${t.adminInput} text-xs`}
              value={b.col_span}
              onChange={(e) => changeWidth(b, Number(e.target.value))}
            >
              {WIDTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={100}
              max={1200}
              step={10}
              placeholder="자동"
              title="높이(px) — 비워두면 자동"
              defaultValue={b.height_px ?? ""}
              key={`${b.id}-${b.height_px}`}
              onBlur={(e) => changeHeight(b, e.target.value)}
              className={`${t.adminInput} text-xs w-20`}
            />
            <button className="text-blue text-xs font-bold" onClick={() => move(b, -1)}>▲</button>
            <button className="text-blue text-xs font-bold" onClick={() => move(b, 1)}>▼</button>
          </li>
        ))}
      </ul>

      <h3 className="text-base font-bold mb-2">미리보기</h3>
      <div className="grid grid-cols-6 gap-2.5 max-w-xl">
        {visiblePreview.map((b) => (
          <div
            key={b.id}
            className={`${COL_SPAN_CLASS[b.col_span] ?? COL_SPAN_CLASS[6]} bg-[#EAF0FB] border border-dashed border-blue rounded-lg p-3 text-xs font-bold text-center text-blue`}
          >
            {b.label}
          </div>
        ))}
        {visiblePreview.length === 0 && (
          <div className="col-span-6 text-muted text-center py-6 text-sm">표시할 블록이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
