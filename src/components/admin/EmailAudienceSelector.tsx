"use client";

import { useRealtimeList } from "@/hooks/useRealtimeList";
import MemberEmailPicker from "./MemberEmailPicker";
import type { DirectoryMember } from "@/lib/types";

const GRADES = ["10", "11", "12"] as const;
const HOMEROOMS = [1, 2, 3] as const;
const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };

export type EmailMode = "all" | "grades" | "homerooms" | "custom";

// "grade-homeroom" 문자열 키로 다룬다(예: "10-2") — Set에 넣고 빼기 편하고, 실제 대상
// 계산 시 다시 { grade, homeroom }으로 풀어서 서버에 보낸다.
export function classKey(grade: string, homeroom: number) {
  return `${grade}-${homeroom}`;
}

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
  classes,
  onToggleClass,
  customMembers,
  onCustomMembersChange,
  isAuto,
  isAdmin,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  mode: EmailMode;
  onModeChange: (m: EmailMode) => void;
  grades: Set<string>;
  onToggleGrade: (g: string) => void;
  classes: Set<string>;
  onToggleClass: (key: string) => void;
  customMembers: DirectoryMember[];
  onCustomMembersChange: (members: DirectoryMember[]) => void;
  isAuto: boolean;
  isAdmin: boolean;
}) {
  // 학급 구성이 학년마다 조금씩 달라서(예: 12학년은 2반이 없음) 실제로 존재하는 학년+반
  // 조합만 선택지로 보여준다 — directory_members에 학생이 없는 조합은 아예 안 보인다.
  const { rows: members } = useRealtimeList<DirectoryMember>("directory_members");
  const availableClasses = new Set(
    members.filter((m) => m.member_type === "student" && m.grade && m.homeroom).map((m) => classKey(m.grade as string, m.homeroom as number))
  );

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
                <div className="ml-6 flex flex-col gap-1">
                  {GRADES.map((g) => {
                    const homeroomsInGrade = HOMEROOMS.filter((h) => availableClasses.has(classKey(g, h)));
                    if (homeroomsInGrade.length === 0) return null;
                    return (
                      <div key={g} className="flex items-center gap-2">
                        <span className="text-xs text-muted w-10">{g}학년</span>
                        {homeroomsInGrade.map((h) => (
                          <label key={h} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={classes.has(classKey(g, h))}
                              onChange={() => onToggleClass(classKey(g, h))}
                            />
                            {HOMEROOM_LABEL[h]}
                          </label>
                        ))}
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-muted m-0">학년과 반을 함께 선택해야 정확한 학급이 지정됩니다.</p>
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" name="audience-mode" checked={mode === "custom"} onChange={() => onModeChange("custom")} />
                직접 지정
              </label>
              {mode === "custom" && (
                <div className="ml-6">
                  <MemberEmailPicker selected={customMembers} onChange={onCustomMembersChange} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
