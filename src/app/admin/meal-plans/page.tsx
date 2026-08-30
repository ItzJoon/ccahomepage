"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { todayKST } from "@/lib/date";
import type { MealPlan } from "@/lib/types";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function AdminMealPlansPage() {
  const supabase = createClient();
  const { rows, reload } = useRealtimeList<MealPlan>("meal_plans", {
    orderBy: { column: "year", ascending: false },
  });
  const sorted = [...rows].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));

  const [today] = useState(() => todayKST());
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = sorted.find((m) => m.year === year && m.month === month) ?? null;

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    // 같은 달 급식표를 다시 올리면(교체) 이전 파일을 지워서 Storage 용량을 낭비하지 않는다.
    if (existing?.image_path) {
      await supabase.storage.from("meal-plans").remove([existing.image_path]);
    }
    const path = `${year}-${String(month).padStart(2, "0")}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("meal-plans").upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("meal-plans").getPublicUrl(path);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: upsertError } = await supabase
      .from("meal_plans")
      .upsert(
        { year, month, image_url: pub.publicUrl, image_path: path, uploaded_by: user?.id ?? null },
        { onConflict: "year,month" }
      );
    if (upsertError) setError(upsertError.message);
    setUploading(false);
    reload();
  };

  const remove = async (m: MealPlan) => {
    if (!confirm(`${m.year}년 ${m.month}월 급식표를 삭제하시겠습니까?`)) return;
    if (m.image_path) await supabase.storage.from("meal-plans").remove([m.image_path]);
    await supabase.from("meal_plans").delete().eq("id", m.id);
    reload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <h2 className="text-[22px] mb-4">급식표 관리</h2>
        <p className="text-muted mb-4 text-sm">
          월별 급식표 사진을 업로드하면 홈 화면 "이번 달 급식표" 블록에 이번 달 것이 자동으로 표시됩니다.
        </p>
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">연도</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">월</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2">미리보기</th>
              <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id} className="hover:bg-[#F2F4F8]">
                <td className="p-2.5 border-b border-border text-sm">{m.year}</td>
                <td className="p-2.5 border-b border-border text-sm">{m.month}월</td>
                <td className="p-2.5 border-b border-border">
                  <img src={m.image_url} alt="" className="h-12 rounded border border-border object-cover" />
                </td>
                <td className="p-2.5 border-b border-border">
                  <button className="text-red text-xs font-bold" onClick={() => remove(m)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted text-center py-8 text-sm">
                  등록된 급식표가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-white border border-border rounded-xl p-[18px] flex flex-col gap-1.5 sticky top-20">
        <h3>급식표 업로드</h3>
        <label className="text-xs font-bold text-muted mt-2">연도</label>
        <input
          type="number"
          className="border border-border rounded-lg px-2.5 py-2 text-sm"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <label className="text-xs font-bold text-muted mt-2">월</label>
        <select
          className="border border-border rounded-lg px-2.5 py-2 text-sm"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
        {existing && (
          <div className="text-xs bg-[#FFF3DC] text-gold rounded-lg px-3 py-2 mt-1">
            이미 등록된 급식표가 있습니다 — 다시 업로드하면 교체됩니다.
          </div>
        )}
        <label className="text-xs font-bold text-muted mt-2">급식표 이미지</label>
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = "";
          }}
          className="text-sm"
        />
        {uploading && <p className="text-muted text-xs">업로드 중…</p>}
        {error && <div className="text-red text-xs">{error}</div>}
        {existing && (
          <img src={existing.image_url} alt="" className="mt-2 w-full rounded-lg border border-border" />
        )}
      </div>
    </div>
  );
}
