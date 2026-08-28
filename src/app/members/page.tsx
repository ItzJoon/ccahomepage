"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import type { DirectoryMember } from "@/lib/types";

const HOMEROOM_LABEL: Record<number, string> = { 1: "샬롬", 2: "헤세드", 3: "토브" };
const GRADES = ["10", "11", "12"] as const;

export default function DirectoryPage() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { rows } = useRealtimeList<DirectoryMember>("directory_members", {
    orderBy: { column: "display_name" },
  });
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [grades, setGrades] = useState<Set<string>>(new Set(GRADES));
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
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

  return (
    <div>
      <SectionTitle eyebrow="DIRECTORY" title="구성원 조회" />
      <p className="text-muted mb-4 text-sm">
        학교 전체 학생·교사 명단입니다. 학생자치회 임원 소개는{" "}
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
          <div className="flex gap-3">
            {GRADES.map((g) => (
              <label key={g} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={grades.has(g)} onChange={() => toggleGrade(g)} />
                {g}학년
              </label>
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
          {students.map((m) => (
            <div key={m.id} className="bg-white border border-border rounded-xl p-4 text-center">
              <div className="font-bold">{m.display_name}</div>
              <div className="text-blue text-sm mt-1">
                {m.grade}학년 {m.homeroom ? HOMEROOM_LABEL[m.homeroom] : ""}
              </div>
            </div>
          ))}
          {students.length === 0 && (
            <div className="text-muted text-center py-8 text-sm col-span-4">일치하는 학생이 없습니다.</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {teachers.map((m) => (
            <div key={m.id} className="bg-white border border-border rounded-xl p-4 text-center">
              <div className="font-bold">{m.display_name}</div>
              <div className="text-blue text-sm mt-1">{m.subject || "-"}</div>
            </div>
          ))}
          {teachers.length === 0 && (
            <div className="text-muted text-center py-8 text-sm col-span-4">일치하는 교사가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
