"use client";

import { useState } from "react";

type TopStreak = { user_id: string; streak_count: number; profiles: { name: string | null; email: string } | null };
type AttendanceRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  visit_date: string;
  streak_count: number;
  is_freeze: boolean;
  created_at: string;
};

export default function StatsTabs({
  totalUsers,
  studentCount,
  teacherCount,
  staffCount,
  todayVisitCount,
  topStreaks,
  attendanceLog,
}: {
  totalUsers: number;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
  todayVisitCount: number;
  topStreaks: TopStreak[];
  attendanceLog: AttendanceRow[];
}) {
  const [tab, setTab] = useState<"log" | "summary">("log");

  return (
    <div>
      <div className="flex gap-1.5 mb-5 border-b border-border">
        <button
          onClick={() => setTab("log")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
            tab === "log" ? "border-navy text-navy" : "border-transparent text-muted"
          }`}
        >
          전체 접속 기록
        </button>
        <button
          onClick={() => setTab("summary")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
            tab === "summary" ? "border-navy text-navy" : "border-transparent text-muted"
          }`}
        >
          요약
        </button>
      </div>

      {tab === "log" && (
        <div>
          <div className="flex gap-3 flex-wrap mb-6">
            <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[150px]">
              <div className="font-serif font-black text-2xl">{todayVisitCount}</div>
              <div className="text-sm text-muted">하루 방문 횟수</div>
            </div>
            <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[150px]">
              <div className="font-serif font-black text-2xl">{totalUsers}</div>
              <div className="text-sm text-muted">전체 가입자 수</div>
            </div>
            <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[150px]">
              <div className="font-serif font-black text-2xl">{teacherCount}</div>
              <div className="text-sm text-muted">선생님 수</div>
            </div>
            <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[150px]">
              <div className="font-serif font-black text-2xl">{studentCount}</div>
              <div className="text-sm text-muted">전체 학생 수</div>
            </div>
            <div className="bg-white border border-border rounded-xl px-5 py-4 min-w-[150px]">
              <div className="font-serif font-black text-2xl">{staffCount}</div>
              <div className="text-sm text-muted">관리 권한 계정 수</div>
            </div>
          </div>

          <h3 className="mb-2">전체 접속 기록 (최신순, 최근 200건)</h3>
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-40">체크인 시각</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2">이메일</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-24">연속일수</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-20">프리즈</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLog.map((row) => (
                <tr key={row.id}>
                  <td className="p-2.5 border-b border-border text-sm">{new Date(row.created_at).toLocaleString("ko-KR")}</td>
                  <td className="p-2.5 border-b border-border text-sm">{row.nickname || row.name || "-"}</td>
                  <td className="p-2.5 border-b border-border text-sm">{row.email}</td>
                  <td className="p-2.5 border-b border-border text-sm">{row.streak_count}일</td>
                  <td className="p-2.5 border-b border-border text-sm">{row.is_freeze ? "❄️" : ""}</td>
                </tr>
              ))}
              {attendanceLog.length === 0 && (
                <tr><td colSpan={5} className="text-muted text-center py-8 text-sm">아직 접속 기록이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "summary" && (
        <div>
          <h3 className="mb-2">연속 접속일수 상위 학생</h3>
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2">이름</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2">이메일</th>
                <th className="text-left text-xs text-muted border-b-2 border-border p-2 w-28">연속 접속일</th>
              </tr>
            </thead>
            <tbody>
              {topStreaks.map((row, i) => (
                <tr key={i}>
                  <td className="p-2.5 border-b border-border text-sm">{row.profiles?.name || "-"}</td>
                  <td className="p-2.5 border-b border-border text-sm">{row.profiles?.email}</td>
                  <td className="p-2.5 border-b border-border text-sm">{row.streak_count}일</td>
                </tr>
              ))}
              {topStreaks.length === 0 && (
                <tr><td colSpan={3} className="text-muted text-center py-8 text-sm">아직 접속 기록이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
