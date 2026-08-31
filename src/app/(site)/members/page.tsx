"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
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

  // 미스터리 인물을 실제 학생 목록 정렬(학년/반/이름순)과 무관하게 무작위 자리에 끼워
  // 넣는다 — 이름순 정렬에 자연스럽게 끼면 "무작위 위치"가 아니게 되므로, 정렬이 끝난
  // 배열에 별도로 삽입한다. 검색어가 있을 땐 이름이 그 검색어를 포함할 때만 보이게 해서
  // 검색 결과 개수와 어긋나지 않게 한다.
  const studentsWithPhantom = useMemo(() => {
    if (!phantomActive) return students;
    if (!grades.has(phantomMember.grade as string)) return students;
    if (q && !phantomMember.display_name.includes(q)) return students;
    const list = [...students];
    const idx = Math.floor(phantomRoll.positionFrac * (list.length + 1));
    list.splice(idx, 0, phantomMember);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, phantomActive, grades, q, phantomMember.display_name, phantomMember.grade]);

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
    const inner = (
      <>
        <div className="font-bold">{m.display_name}</div>
        <div className="text-blue text-sm mt-1">{sub}</div>
      </>
    );
    if (m.id === PHANTOM_ID) {
      return (
        <Link
          key={m.id}
          href="/members/mystery"
          className="bg-white border-2 border-dashed border-gold rounded-xl p-4 text-center hover:shadow-md transition-shadow"
        >
          {inner}
        </Link>
      );
    }
    const joined = profilesByEmail[m.email];
    if (joined) {
      return (
        <Link
          key={m.id}
          href={`/members/${joined.id}`}
          className="bg-white border border-border rounded-xl p-4 text-center hover:shadow-md hover:border-blue transition-shadow"
        >
          {inner}
        </Link>
      );
    }
    return (
      <div
        key={m.id}
        title="아직 가입하지 않은 계정입니다"
        className="bg-[#F5F6F8] border border-border rounded-xl p-4 text-center text-muted cursor-not-allowed opacity-60"
      >
        {inner}
        <div className="text-[11px] text-muted mt-1.5">미가입</div>
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
