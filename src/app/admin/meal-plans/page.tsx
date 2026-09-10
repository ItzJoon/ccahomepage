"use client";

import AdminTable from "@/components/admin/AdminTable";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useList } from "@/hooks/useList";
import { todayKST } from "@/lib/date";
import { safeStorageKey } from "@/lib/storageKey";
import { useHomeTheme } from "@/hooks/useHomeTheme";
import type { MealPlan, MealType, SiteSettings } from "@/lib/types";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const MEAL_TYPE_LABEL: Record<MealType, string> = { lunch: "중식", dinner: "석식" };
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function AdminMealPlansPage() {
  const supabase = createClient();
  const { t } = useHomeTheme();
  const { rows, reload } = useList<MealPlan>("meal_plans", {
    orderBy: { column: "year", ascending: false },
  });
  const { rows: settingsRows, reload: reloadSettings } = useList<SiteSettings>("site_settings");
  const settings = settingsRows.find((s) => s.id === "default");
  const sorted = [...rows].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  // 목록은 (year, month) 단위로 묶어서 중식/석식이 각각 등록됐는지 한 행에서 바로 보이게 한다.
  const groupKeys = Array.from(new Set(sorted.map((m) => `${m.year}-${m.month}`)));

  const [today] = useState(() => todayKST());
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchTime, setSwitchTime] = useState<string | null>(null);
  const [dinnerDays, setDinnerDays] = useState<number[] | null>(null);
  const [savingSwitchTime, setSavingSwitchTime] = useState(false);

  const existing = sorted.find((m) => m.year === year && m.month === month && m.meal_type === mealType) ?? null;

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    // 같은 달/같은 끼니 급식표를 다시 올리면(교체) 이전 파일을 지워서 Storage 용량을 낭비하지 않는다.
    if (existing?.image_path) {
      await supabase.storage.from("meal-plans").remove([existing.image_path]);
    }
    // 원본 파일명(한글/공백 등 포함 가능)을 그대로 스토리지 키로 쓰면 "Invalid key" 오류가
    // 나므로, 안전한 키로 바꿔서 올리고 원본 이름은 DB(original_file_name)에 따로 저장한다.
    const path = safeStorageKey(file.name, `${year}-${String(month).padStart(2, "0")}-${mealType}`);
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
        {
          year,
          month,
          meal_type: mealType,
          image_url: pub.publicUrl,
          image_path: path,
          original_file_name: file.name,
          uploaded_by: user?.id ?? null,
        },
        { onConflict: "year,month,meal_type" }
      );
    if (upsertError) setError(upsertError.message);
    setUploading(false);
    reload();
  };

  const remove = async (m: MealPlan) => {
    if (!confirm(`${m.year}년 ${m.month}월 ${MEAL_TYPE_LABEL[m.meal_type]} 급식표를 삭제하시겠습니까?`)) return;
    if (m.image_path) await supabase.storage.from("meal-plans").remove([m.image_path]);
    await supabase.from("meal_plans").delete().eq("id", m.id);
    reload();
  };

  const effectiveDinnerDays = dinnerDays ?? settings?.dinner_days ?? [1, 3, 4];
  const toggleDinnerDay = (day: number) => {
    const next = effectiveDinnerDays.includes(day)
      ? effectiveDinnerDays.filter((d) => d !== day)
      : [...effectiveDinnerDays, day].sort();
    setDinnerDays(next);
  };

  const saveSwitchTime = async () => {
    if (!switchTime && !dinnerDays) return;
    setSavingSwitchTime(true);
    await supabase
      .from("site_settings")
      .update({
        dinner_switch_time: switchTime ?? settings?.dinner_switch_time,
        dinner_days: effectiveDinnerDays,
      })
      .eq("id", "default");
    setSavingSwitchTime(false);
    reloadSettings();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[18px] items-start">
      <div className="min-w-0">
        <h2 className="text-[22px] mb-4">급식표 관리</h2>
        <p className="text-muted mb-4 text-sm">
          중식/석식 급식표 사진을 각각 업로드하면 홈 화면 "이번 달 급식표" 블록에 현재 시각 기준으로
          알맞은 것이 자동으로 표시됩니다.
        </p>
        <AdminTable>
          <thead>
            <tr>
              <th className={`${t.adminTableHeaderCell} w-24`}>연도</th>
              <th className={`${t.adminTableHeaderCell} w-20`}>월</th>
              <th className={t.adminTableHeaderCell}>중식</th>
              <th className={t.adminTableHeaderCell}>석식</th>
            </tr>
          </thead>
          <tbody>
            {groupKeys.map((key) => {
              const [y, mo] = key.split("-").map(Number);
              const lunch = sorted.find((m) => m.year === y && m.month === mo && m.meal_type === "lunch");
              const dinner = sorted.find((m) => m.year === y && m.month === mo && m.meal_type === "dinner");
              const cell = (m: MealPlan | undefined) =>
                m ? (
                  <div className="flex items-center gap-2">
                    <img src={m.image_url} alt="" className="h-12 rounded border border-border object-cover" />
                    {m.original_file_name && <span className="text-xs text-muted truncate max-w-[120px]">{m.original_file_name}</span>}
                    <button className={`${t.adminBtnDanger} shrink-0`} onClick={() => remove(m)}>
                      삭제
                    </button>
                  </div>
                ) : (
                  <span className="text-muted text-xs">미등록</span>
                );
              return (
                <tr key={key} className={t.adminTableRowHover}>
                  <td className={t.adminTableCell}>{y}</td>
                  <td className={t.adminTableCell}>{mo}월</td>
                  <td className={t.adminTableCell}>{cell(lunch)}</td>
                  <td className={t.adminTableCell}>{cell(dinner)}</td>
                </tr>
              );
            })}
            {groupKeys.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted text-center py-8 text-sm">
                  등록된 급식표가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </AdminTable>
      </div>
      <div className="flex flex-col gap-[18px]">
        <div className={`${t.adminEditPanel} flex flex-col gap-1.5`}>
          <h3>급식표 업로드</h3>
          <label className="text-xs font-bold text-muted mt-2">연도</label>
          <input
            type="number"
            className={t.adminInput}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <label className="text-xs font-bold text-muted mt-2">월</label>
          <select
            className={t.adminInput}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <label className="text-xs font-bold text-muted mt-2">구분</label>
          <div className="flex border border-border rounded-lg overflow-hidden w-fit">
            {(["lunch", "dinner"] as MealType[]).map((mt) => (
              <button
                key={mt}
                type="button"
                className={`px-3.5 py-1.5 text-sm font-semibold border-0 ${mealType === mt ? t.adminToggleActive : "bg-surface"}`}
                onClick={() => setMealType(mt)}
              >
                {MEAL_TYPE_LABEL[mt]}
              </button>
            ))}
          </div>
          {existing && (
            <div className="text-xs bg-[#FFF3DC] dark:bg-white/10 text-gold rounded-lg px-3 py-2 mt-1">
              이미 등록된 {MEAL_TYPE_LABEL[mealType]} 급식표가 있습니다 — 다시 업로드하면 교체됩니다.
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
        <div className={`${t.adminEditPanel} flex flex-col gap-1.5`}>
          <h3>석식 전환 시각</h3>
          <p className="text-muted text-xs">
            이 시각 이후에는 학생 화면에 석식 급식표가 표시됩니다(그 전까지는 중식).
          </p>
          <input
            type="time"
            className={t.adminInput}
            value={(switchTime ?? settings?.dinner_switch_time ?? "13:30:00").slice(0, 5)}
            onChange={(e) => setSwitchTime(e.target.value)}
          />
          <label className="text-xs font-bold text-muted mt-2">석식 제공 요일</label>
          <div className="flex gap-1.5 flex-wrap">
            {DAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDinnerDay(day)}
                className={`w-9 h-9 rounded-lg text-sm font-bold border ${
                  effectiveDinnerDays.includes(day)
                    ? "bg-navy text-white border-navy"
                    : "bg-surface text-muted border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs">선택한 요일에만 전환 시각 기준으로 석식이 표시됩니다. 그 외 요일은 항상 중식입니다.</p>
          <button
            onClick={saveSwitchTime}
            disabled={(!switchTime && !dinnerDays) || savingSwitchTime}
            className={`${t.adminBtnPrimary} disabled:opacity-40 disabled:cursor-not-allowed w-fit mt-1`}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
