"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useList } from "@/hooks/useList";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import ListSkeleton from "@/components/ListSkeleton";
import { todayKST } from "@/lib/date";
import type { SpecialEvent, UniformCheck, DirectoryMember } from "@/lib/types";

/** 날짜 문자열 비교(YYYY-MM-DD는 사전식 비교가 그대로 날짜 비교와 같다). */
const clampDate = (d: string, min: string, max: string) => (d < min ? min : d > max ? max : d);

// 다른 화면(admin/users, rankings 등)과 같은 반 이름 매핑. 그쪽은 "학년 + 샬롬" 형태로
// 쓰지만 여기는 더 간결하게 "10샬롬"처럼 붙여 쓴다(요청 반영).
const HOMEROOM_NAME: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };
const classLabel = (grade: string, homeroom: number) => `${grade}${HOMEROOM_NAME[homeroom] ?? `${homeroom}반`}`;

export default function EventSpecialDetailClient({
  event,
  myId,
  myClass,
}: {
  event: SpecialEvent;
  myId: string | null;
  myClass: { grade: string; homeroom: number } | null;
}) {
  const supabase = createClient();
  const today = todayKST();
  // 대의원 체크 UI의 날짜 선택 기본값은 오늘이되, 이벤트 기간을 벗어나지 못하게 묶는다.
  const [checkDate, setCheckDate] = useState(() => clampDate(today, event.start_date, event.end_date));
  const [saving, setSaving] = useState(false);

  const { rows: directory, loading: directoryLoading } = useList<DirectoryMember>("directory_members");
  // 이벤트 전체 체크 기록을 실시간 구독 — 대의원이 체크하는 즉시 오늘 현황판/랭킹이
  // 모든 열람자 화면에서 새로고침 없이 갱신된다(이미 realtime publication에 추가함).
  const { rows: checks, loading: checksLoading } = useRealtimeList<UniformCheck>("uniform_checks", {
    filter: (q) => q.eq("event_id", event.id),
  });
  // directory가 늦게 도착하면서 "반 정보가 없습니다"였다가 뒤늦게 채워지는 팝인을
  // 막기 위해, 둘 다 끝날 때까지는 ListSkeleton으로 가린다.
  const boardLoading = directoryLoading || checksLoading;

  const classes = useMemo(() => {
    const set = new Map<string, { grade: string; homeroom: number }>();
    directory
      .filter((d) => d.member_type === "student" && d.grade && d.homeroom)
      .forEach((d) => set.set(`${d.grade}-${d.homeroom}`, { grade: d.grade as string, homeroom: d.homeroom as number }));
    return Array.from(set.values()).sort((a, b) => a.grade.localeCompare(b.grade) || a.homeroom - b.homeroom);
  }, [directory]);

  const todayChecks = useMemo(() => checks.filter((c) => c.check_date === today), [checks, today]);

  const myRoster = useMemo(
    () => (myClass ? directory.filter((d) => d.member_type === "student" && d.grade === myClass.grade && d.homeroom === myClass.homeroom) : []),
    [directory, myClass]
  );
  const myCheckForDate = useMemo(
    () => (myClass ? checks.find((c) => c.grade === myClass.grade && c.homeroom === myClass.homeroom && c.check_date === checkDate) : undefined),
    [checks, myClass, checkDate]
  );

  const submitCheck = async (allWearing: boolean) => {
    if (!myId || !myClass || saving) return;
    setSaving(true);
    if (myCheckForDate) {
      await supabase.from("uniform_checks").update({ all_wearing: allWearing }).eq("id", myCheckForDate.id);
    } else {
      await supabase
        .from("uniform_checks")
        .insert({ event_id: event.id, grade: myClass.grade, homeroom: myClass.homeroom, check_date: checkDate, all_wearing: allWearing });
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {event.event_type === "uniform_check" && (
        <div className="bg-surface border border-border rounded-2xl p-4">
          <h2 className="text-lg font-bold mb-3">오늘 반별 현황</h2>
          {boardLoading ? (
            <ListSkeleton rows={3} />
          ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {classes.map((c) => {
              const check = todayChecks.find((x) => x.grade === c.grade && x.homeroom === c.homeroom);
              const state = !check ? "미체크" : check.all_wearing ? "성공" : "실패";
              const style =
                state === "성공"
                  ? "bg-[#E6F5F0] dark:bg-white/10 text-teal border-teal"
                  : state === "실패"
                  ? "bg-[#FDEBEC] dark:bg-white/10 text-red border-red"
                  : "bg-[#F2F4F8] dark:bg-white/10 text-muted border-border";
              return (
                <div key={`${c.grade}-${c.homeroom}`} className={`border rounded-xl p-2.5 text-center ${style}`}>
                  <div className="text-xs font-bold">{classLabel(c.grade, c.homeroom)}</div>
                  <div className="text-sm font-black mt-1">{state}</div>
                </div>
              );
            })}
            {classes.length === 0 && <div className="text-muted text-sm col-span-full">반 정보가 없습니다.</div>}
          </div>
          )}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
        <p className="text-muted text-sm mb-2">{event.start_date} ~ {event.end_date}</p>
        {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
      </div>

      {event.event_type === "uniform_check" && (
        <>
          {myClass && boardLoading && (
            <div className="bg-surface border border-border rounded-2xl p-4">
              <ListSkeleton rows={2} />
            </div>
          )}
          {myClass && !boardLoading && (
            <div className="bg-surface border border-border rounded-2xl p-4">
              <h2 className="text-lg font-bold mb-1">우리 반({classLabel(myClass.grade, myClass.homeroom)}) 체크</h2>
              <p className="text-muted text-xs mb-3">대의원만 체크할 수 있습니다. 지난 날짜를 골라 소급 입력·정정도 가능합니다.</p>
              <label className="text-xs font-bold text-muted block mb-1">체크할 날짜</label>
              <input
                type="date"
                className="border border-border rounded-lg px-2.5 py-2 text-sm mb-3"
                value={checkDate}
                min={event.start_date}
                max={clampDate(today, event.start_date, event.end_date)}
                onChange={(e) => setCheckDate(e.target.value)}
              />
              <details className="mb-3">
                <summary className="text-sm font-bold cursor-pointer">우리 반 명단 참고 ({myRoster.length}명)</summary>
                <ul className="list-none m-0 p-0 mt-2 text-sm text-muted flex flex-col gap-0.5">
                  {myRoster.map((s) => (
                    <li key={s.id}>{s.display_name}</li>
                  ))}
                </ul>
              </details>
              {myCheckForDate && (
                <p className="text-xs text-muted mb-2">
                  현재 기록: <strong>{myCheckForDate.all_wearing ? "전원 착용" : "미착용자 있음"}</strong>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  onClick={() => submitCheck(true)}
                  className={`flex-1 rounded-lg py-2.5 font-bold text-sm disabled:opacity-50 ${
                    myCheckForDate?.all_wearing === true ? "bg-teal text-white" : "border border-border"
                  }`}
                >
                  전원 착용
                </button>
                <button
                  disabled={saving}
                  onClick={() => submitCheck(false)}
                  className={`flex-1 rounded-lg py-2.5 font-bold text-sm disabled:opacity-50 ${
                    myCheckForDate?.all_wearing === false ? "bg-red text-white" : "border border-border"
                  }`}
                >
                  미착용자 있음
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
