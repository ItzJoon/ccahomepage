"use client";

import type { EmailAudience } from "@/lib/types";

const GRADES = ["10", "11", "12"];
const HOMEROOMS = [
  { value: 1, label: "샬롬" },
  { value: 2, label: "헤세드" },
  { value: 3, label: "토브" },
];

export type EmailMode = "all" | "grades" | "homerooms" | "custom";

/**
 * "이메일로 알림 보내기" 체크박스 + 대상 선택 UI. 네트워크 호출이나 발송 로직은 전혀
 * 갖고 있지 않은 순수 표시/입력 컴포넌트다 — 실제 미리보기·저장·발송은 이 컴포넌트를
 * 쓰는 화면(PostManager)이 buildAudience()로 값을 읽어가서 처리한다. 그래야 "게시하기"
 * 버튼 하나로 저장과 발송을 한 번에 묶어서 처리할 수 있다.
 */
export default function EmailAudienceSelector({
  enabled,
  onEnabledChange,
  mode,
  onModeChange,
  grades,
  onToggleGrade,
  homerooms,
  onToggleHomeroom,
  customEmails,
  onCustomEmailsChange,
  isAuto,
  isAdmin,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  mode: EmailMode;
  onModeChange: (m: EmailMode) => void;
  grades: Set<string>;
  onToggleGrade: (g: string) => void;
  homerooms: Set<number>;
  onToggleHomeroom: (h: number) => void;
  customEmails: string;
  onCustomEmailsChange: (v: string) => void;
  isAuto: boolean;
  isAdmin: boolean;
}) {
  return (
    <div className="border-t border-border mt-3.5 pt-3.5">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        이메일로 알림 보내기
      </label>
      {enabled && (
        <div className="bg-bg rounded-lg p-3.5 mt-2 flex flex-col gap-2">
          {isAuto ? (
            <p className="text-xs text-muted m-0">
              교과/학급 공지는 이미 저장된 대상(교과 수강생 또는 해당 학급)에게만 자동으로 발송됩니다.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="audience-mode" checked={mode === "all"} disabled={!isAdmin} onChange={() => onModeChange("all")} />
                전체 학생/교사 {!isAdmin && <span className="text-[11px] text-muted">(admin 이상만 선택 가능)</span>}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="audience-mode" checked={mode === "grades"} onChange={() => onModeChange("grades")} />
                특정 학년만
              </label>
              {mode === "grades" && (
                <div className="flex gap-2 ml-6">
                  {GRADES.map((g) => (
                    <label key={g} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={grades.has(g)} onChange={() => onToggleGrade(g)} /> {g}학년
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" name="audience-mode" checked={mode === "homerooms"} onChange={() => onModeChange("homerooms")} />
                특정 학급만
              </label>
              {mode === "homerooms" && (
                <div className="flex gap-2 ml-6">
                  {HOMEROOMS.map((h) => (
                    <label key={h.value} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={homerooms.has(h.value)} onChange={() => onToggleHomeroom(h.value)} /> {h.label}
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" name="audience-mode" checked={mode === "custom"} onChange={() => onModeChange("custom")} />
                직접 입력
              </label>
              {mode === "custom" && (
                <textarea
                  rows={3}
                  className="border border-border rounded-lg px-2.5 py-2 text-xs ml-6"
                  placeholder="이메일 주소를 쉼표 또는 줄바꿈으로 구분해서 입력하세요"
                  value={customEmails}
                  onChange={(e) => onCustomEmailsChange(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
