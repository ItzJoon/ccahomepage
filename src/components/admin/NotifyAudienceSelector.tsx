"use client";

import { useList } from "@/hooks/useList";
import MemberEmailPicker from "./MemberEmailPicker";
import type { DirectoryMember } from "@/lib/types";
import type { NotifyAudience } from "@/lib/notificationAudienceResolve";

const GRADES = ["10", "11", "12"] as const;
const HOMEROOMS = [1, 2, 3] as const;
const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };

export function classKey(grade: string, homeroom: number) {
  return `${grade}-${homeroom}`;
}

/**
 * 배너·팝업 알림의 발송 대상 선택 UI. 이메일 발송의 EmailAudienceSelector와 같은
 * 구조지만, 여기선 대상 선택 자체가 폼의 필수 부분이라("이메일로 알림 보내기" 같은
 * on/off 체크박스 없이) 항상 펼쳐져 있고, admin 제한("전체"는 admin만) 없이 이 화면에
 * 들어올 수 있는 사람(editor 이상) 누구나 모든 대상을 고를 수 있다 — 지금까지 배너·팝업은
 * 원래 대상 구분 없이 항상 전체 공개였고 그 권한 기준을 그대로 유지한다.
 */
export default function NotifyAudienceSelector({
  mode,
  onModeChange,
  grades,
  onToggleGrade,
  classes,
  onToggleClass,
  customMembers,
  onCustomMembersChange,
}: {
  mode: NotifyAudience["mode"];
  onModeChange: (m: NotifyAudience["mode"]) => void;
  grades: Set<string>;
  onToggleGrade: (g: string) => void;
  classes: Set<string>;
  onToggleClass: (key: string) => void;
  customMembers: DirectoryMember[];
  onCustomMembersChange: (members: DirectoryMember[]) => void;
}) {
  const { rows: members } = useList<DirectoryMember>("directory_members");
  const availableClasses = new Set(
    members.filter((m) => m.member_type === "student" && m.grade && m.homeroom).map((m) => classKey(m.grade as string, m.homeroom as number))
  );

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label className="flex items-center gap-2">
        <input type="radio" name="notify-audience-mode" checked={mode === "all"} onChange={() => onModeChange("all")} />
        전체 학생/교사
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" name="notify-audience-mode" checked={mode === "grades"} onChange={() => onModeChange("grades")} />
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
        <input type="radio" name="notify-audience-mode" checked={mode === "homerooms"} onChange={() => onModeChange("homerooms")} />
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
                    <input type="checkbox" checked={classes.has(classKey(g, h))} onChange={() => onToggleClass(classKey(g, h))} />
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
        <input type="radio" name="notify-audience-mode" checked={mode === "custom"} onChange={() => onModeChange("custom")} />
        직접 지정
      </label>
      {mode === "custom" && (
        <div className="ml-6">
          <MemberEmailPicker selected={customMembers} onChange={onCustomMembersChange} />
        </div>
      )}
    </div>
  );
}
