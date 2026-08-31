"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { useTrackPageVisit } from "@/hooks/useTrackPageVisit";
import SectionTitle from "@/components/SectionTitle";
import type { BadgeDef, DirectoryMember, DirectoryProfileView } from "@/lib/types";

const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };
const GRADES = ["10", "11", "12"] as const;

// 이스터에그 "미스터리 인물"이 나타날 수 있는 반 목록(요건에 명시된 조합 그대로 —
// 12학년 헤세드는 포함하지 않음).
const PHANTOM_COMBOS: { grade: "10" | "11" | "12"; homeroom: 1 | 2 | 3 }[] = [
  { grade: "10", homeroom: 1 },
  { grade: "10", homeroom: 2 },
  { grade: "10", homeroom: 3 },
  { grade: "11", homeroom: 1 },
  { grade: "11", homeroom: 2 },
  { grade: "11", homeroom: 3 },
  { grade: "12", homeroom: 1 },
  { grade: "12", homeroom: 3 },
];
const PHANTOM_ID = "__phantom_member__";

export default function DirectoryPage() {
  useTrackPageVisit("members"); // "탐험가" 뱃지용 방문 기록
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { rows } = useRealtimeList<DirectoryMember>("directory_members", {
    orderBy: { column: "display_name" },
  });
  // 명단에는 있지만 아직 가입(첫 로그인)하지 않은 사람도 있을 수 있다. 그런 계정은 profiles
  // row가 없어 프로필을 보여줄 게 없으므로, 이메일 기준으로 가입 여부를 따로 조회해서
  // 회색으로 표시하고 클릭을 막는다. profiles는 RLS상 본인/관리자만 열람 가능해서, 이 조회는
  // 뷰(directory_profile_view)를 통해 우회한다(뷰 자체가 이름/사진/소개 등 공개 가능한 값만 노출).
  const [profilesByEmail, setProfilesByEmail] = useState<Record<string, DirectoryProfileView>>({});
  // 탭/학년 필터/검색어를 URL 쿼리에 반영해둔다 — 구성원을 눌러 프로필로 갔다가 뒤로가기로
  // 돌아왔을 때, 상태가 URL(브라우저 히스토리)에 그대로 남아있어서 필터가 초기화되지 않는다.
  const [tab, setTab] = useState<"student" | "teacher">(searchParams.get("tab") === "teacher" ? "teacher" : "student");
  const [grades, setGrades] = useState<Set<string>>(() => {
    const g = searchParams.get("grades");
    if (g === null) return new Set(GRADES);
    if (g === "") return new Set();
    return new Set(g.split(","));
  });
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // 이스터에그 "미스터리 인물" — 뱃지(code='phantom_member')가 활성화돼 있을 때만 나타난다.
  // is_active/easter_egg_names를 실시간 구독해서, 관리자가 뱃지를 끄면 새로고침 없이도
  // 바로 사라진다.
  const { rows: phantomBadgeRows } = useRealtimeList<BadgeDef>("badges", {
    filter: (query) => query.eq("code", "phantom_member"),
  });
  const phantomBadge = phantomBadgeRows[0];
  const phantomActive = !!phantomBadge?.is_active;
  // 반/위치(목록 내 자리)/이름 중 반과 자리는 페이지에 들어올 때(=마운트할 때)만 한 번
  // 뽑아서 필터를 바꾸는 동안엔 요건대로 그대로 유지되다가, 페이지를 나갔다 다시
  // 들어오면(재마운트) 새로 뽑힌다. 이름은 뱃지 데이터가 나중에 도착하므로 "몇 번째
  // 이름을 고를지" 비율만 미리 고정해두고 실제 목록이 오면 그걸로 골라 뽑는다.
  const [phantomRoll] = useState(() => ({
    combo: PHANTOM_COMBOS[Math.floor(Math.random() * PHANTOM_COMBOS.length)],
    positionFrac: Math.random(),
    nameFrac: Math.random(),
  }));
  const phantomNames = phantomBadge?.easter_egg_names ?? [];
  const phantomName = phantomNames.length > 0 ? phantomNames[Math.floor(phantomRoll.nameFrac * phantomNames.length)] : "???";
  const phantomMember: DirectoryMember = {
    id: PHANTOM_ID,
    email: "phantom@invalid.local",
    member_type: "student",
    display_name: phantomName,
    grade: phantomRoll.combo.grade,
    homeroom: phantomRoll.combo.homeroom,
    homeroom_label: null,
    subject: null,
    leadership_role: null,
    is_allowed: true,
    created_at: new Date().toISOString(),
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "student") params.set("tab", tab);
    const gradesArr = Array.from(grades);
    if (gradesArr.length !== GRADES.length) params.set("grades", gradesArr.join(","));
    if (q) params.set("q", q);
    const qs = params.toString();
    router.replace(qs ? `/members?${qs}` : "/members", { scroll: false });
  }, [tab, grades, q, router]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [supabase]);

  useEffect(() => {
    supabase
      .from("directory_profile_view")
      .select("*")
      .then(({ data }) => {
        setProfilesByEmail(Object.fromEntries(((data as DirectoryProfileView[]) ?? []).map((p) => [p.email, p])));
      });
  }, [supabase]);

  const toggleGrade = (g: string) => {
    setGrades((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const students = useMemo(() => {
    return rows
      .filter((m) => m.member_type === "student")
      .filter((m) => !m.grade || grades.has(m.grade))
      .filter((m) => m.display_name.includes(q))
      .sort((a, b) => {
        const gradeDiff = (a.grade ?? "").localeCompare(b.grade ?? "");
        if (gradeDiff !== 0) return gradeDiff;
        const homeroomDiff = (a.homeroom ?? 0) - (b.homeroom ?? 0);
        if (homeroomDiff !== 0) return homeroomDiff;
        return a.display_name.localeCompare(b.display_name, "ko");
      });
  }, [rows, grades, q]);

  // 미스터리 인물을 완전히 아무 데나 끼우면 반(학년+반) 단위로 묶여 정렬된 순서가 깨져서
  // 오히려 티가 난다 — 뽑힌 반의 학생들 사이 구간을 찾아 그 안에서만 무작위 위치에
  // 끼운다(그 반에 실제 학생이 한 명도 없으면, 정렬 순서상 그 반이 있어야 할 자리에
  // 자동으로 들어간다). 학년 필터를 "전체"가 아니라 일부만 선택해서 인원을 줄이면
  // 찾기 쉬워지므로, 학년 필터가 전체 선택 상태일 때만 나타난다. 검색창에 뭔가 입력하는
  // 순간에도(우연히 무작위 이름과 겹치는 경우까지 포함해서) 검색으로는 절대 찾을 수
  // 없어야 하므로, 검색어가 하나라도 있으면 무조건 안 보이게 한다.
  const isAllGradesSelected = grades.size === GRADES.length;
  const gradeHomeroomKey = (grade: string | null, homeroom: number | null) => `${grade ?? ""}-${homeroom ?? 0}`;
  const studentsWithPhantom = useMemo(() => {
    if (!phantomActive || !isAllGradesSelected) return students;
    if (q) return students;
    const list = [...students];
    const phantomKey = gradeHomeroomKey(phantomMember.grade, phantomMember.homeroom);
    let start = 0;
    while (start < list.length && gradeHomeroomKey(list[start].grade, list[start].homeroom) < phantomKey) start++;
    let end = start;
    while (end < list.length && gradeHomeroomKey(list[end].grade, list[end].homeroom) === phantomKey) end++;
    const idx = start + Math.floor(phantomRoll.positionFrac * (end - start + 1));
    list.splice(idx, 0, phantomMember);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, phantomActive, isAllGradesSelected, q, phantomMember.display_name]);

  const teachers = useMemo(() => {
    return rows
      .filter((m) => m.member_type === "teacher")
      .filter((m) => m.display_name.includes(q))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, "ko"));
  }, [rows, q]);

  if (signedIn === false) {
    return (
      <div>
        <SectionTitle eyebrow="DIRECTORY" title="구성원 조회" />
        <div className="bg-white border border-border rounded-xl p-8 text-center text-muted text-sm">
          로그인한 학교 구성원만 열람할 수 있습니다.{" "}
          <Link href="/login" className="text-blue font-bold">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  const renderCard = (m: DirectoryMember, sub: string) => {
    const isPhantom = m.id === PHANTOM_ID;
    const joined = isPhantom ? null : profilesByEmail[m.email];
    const showMigaib = !isPhantom && !joined;
    const inner = (
      <>
        <div className="font-bold">{m.display_name}</div>
        <div className="text-blue text-sm mt-1">{sub}</div>
        {/* "미가입" 표시가 없는 카드도 이 줄만큼 자리를 차지해야 한다 — grid는 같은 행
            안에서만 카드 높이를 맞추므로, 어쩌다 한 행이 전부 미가입 표시가 없는(2줄)
            카드로만 이뤄지면 그 행만 유독 짧아 보이는 문제가 있었다. 항상 같은 구조로
            렌더링하고 필요 없을 때만 invisible로 감춰서 자리는 그대로 차지하게 한다. */}
        <div className={`text-[11px] mt-1.5 ${showMigaib ? "text-muted" : "invisible"}`}>미가입</div>
      </>
    );
    // 카드는 grid 셀을 항상 꽉 채워야 한다(width: 100%) — 이걸 명시하지 않으면 이름
    // 길이 등 내용에 따라 카드 자체의 고유 폭(min-content)이 셀 폭보다 커지려는 경우
    // 카드마다 렌더링 폭이 달라져 격자 정렬이 흐트러질 수 있다. 세 카드 종류(미스터리
    // 인물/가입한 구성원/미가입 구성원) 전부 동일하게 적용한다.
    if (isPhantom) {
      return (
        <Link
          key={m.id}
          href="/members/mystery"
          className="w-full min-w-0 bg-white border border-border rounded-xl p-4 text-center hover:shadow-md hover:border-blue transition-shadow"
        >
          {inner}
        </Link>
      );
    }
    if (joined) {
      return (
        <Link
          key={m.id}
          href={`/members/${joined.id}`}
          className="w-full min-w-0 bg-white border border-border rounded-xl p-4 text-center hover:shadow-md hover:border-blue transition-shadow"
        >
          {inner}
        </Link>
      );
    }
    return (
      <div
        key={m.id}
        title="아직 가입하지 않은 계정입니다"
        className="w-full min-w-0 bg-[#F5F6F8] border border-border rounded-xl p-4 text-center text-muted cursor-not-allowed opacity-60"
      >
        {inner}
      </div>
    );
  };

  return (
    <div>
      <SectionTitle eyebrow="DIRECTORY" title="구성원 조회" />
      <p className="text-muted mb-4 text-sm">
        학교 전체 학생·교사 명단입니다. 이름을 클릭하면 프로필을 볼 수 있어요(아직 가입하지 않은
        계정은 회색으로 표시됩니다). 학생자치회 임원 소개는{" "}
        <Link href="/organizations" className="text-blue font-bold">
          학생자치회 소개
        </Link>{" "}
        페이지에서 볼 수 있어요.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("student")}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold ${
            tab === "student" ? "bg-navy text-white" : "bg-white border border-border text-muted"
          }`}
        >
          학생
        </button>
        <button
          onClick={() => setTab("teacher")}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold ${
            tab === "teacher" ? "bg-navy text-white" : "bg-white border border-border text-muted"
          }`}
        >
          교사
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {tab === "student" && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setGrades(grades.size === GRADES.length ? new Set() : new Set(GRADES))}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 ${
                grades.size === GRADES.length ? "bg-navy text-white border-navy" : "bg-white text-navy border-navy"
              }`}
            >
              전체
            </button>
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => toggleGrade(g)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                  grades.has(g) ? "bg-teal text-white border-teal" : "bg-white text-muted border-border"
                }`}
              >
                {g}학년
              </button>
            ))}
          </div>
        )}
        <input
          className="border border-border rounded-lg px-3 py-2 text-sm ml-auto w-full max-w-[200px]"
          placeholder="이름으로 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {tab === "student" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {studentsWithPhantom.map((m) => renderCard(m, `${m.grade}학년 ${m.homeroom ? HOMEROOM_LABEL[m.homeroom] : ""}`))}
          {students.length === 0 && (
            <div className="text-muted text-center py-8 text-sm col-span-4">일치하는 학생이 없습니다.</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {teachers.map((m) => renderCard(m, m.subject || "-"))}
          {teachers.length === 0 && (
            <div className="text-muted text-center py-8 text-sm col-span-4">일치하는 교사가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
