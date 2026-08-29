"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import type { DirectoryMember, DirectoryProfileView } from "@/lib/types";

const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };
const GRADES = ["10", "11", "12"] as const;

export default function DirectoryPage() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { rows } = useRealtimeList<DirectoryMember>("directory_members", {
    orderBy: { column: "display_name" },
  });
  // 명단에는 있지만 아직 가입(첫 로그인)하지 않은 사람도 있을 수 있다. 그런 계정은 profiles
  // row가 없어 프로필을 보여줄 게 없으므로, 이메일 기준으로 가입 여부를 따로 조회해서
  // 회색으로 표시하고 클릭을 막는다. profiles는 RLS상 본인/관리자만 열람 가능해서, 이 조회는
  // 뷰(directory_profile_view)를 통해 우회한다(뷰 자체가 이름/사진/소개 등 공개 가능한 값만 노출).
  const [profilesByEmail, setProfilesByEmail] = useState<Record<string, DirectoryProfileView>>({});
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [grades, setGrades] = useState<Set<string>>(new Set(GRADES));
  const [q, setQ] = useState("");

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
    const joined = profilesByEmail[m.email];
    const inner = (
      <>
        <div className="font-bold">{m.display_name}</div>
        <div className="text-blue text-sm mt-1">{sub}</div>
      </>
    );
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
          {students.map((m) => renderCard(m, `${m.grade}학년 ${m.homeroom ? HOMEROOM_LABEL[m.homeroom] : ""}`))}
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
