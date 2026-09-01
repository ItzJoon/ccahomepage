"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * 사이트 제한(수업시간 등) 시간대에 학생 계정이 Q&A/게시판에 접속하면 middleware.ts가
 * 여기로 돌려보낸다. 다른 메뉴(공지/뉴스/일정 등)는 이 시간에도 그대로 열람 가능해서
 * /suspended·/access-restricted처럼 사이트 전체를 막는 화면이 아니라, 홈으로 돌아가는
 * 링크만 안내한다.
 */
export default function RestrictedPage() {
  const searchParams = useSearchParams();
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <div className="bg-white border border-border rounded-2xl p-8 text-center max-w-md w-full shadow-sm">
        <div className="text-4xl mb-3">🔔</div>
        <h1 className="text-xl font-black mb-2">지금은 이용 시간이 아니에요</h1>
        <p className="text-muted text-sm mb-2 whitespace-pre-wrap">
          현재 수업시간이라 Q&A/게시판 이용이 제한되어 있어요.{"\n"}
          제한 시간이 끝나면 다시 이용할 수 있습니다.
        </p>
        {start && end && (
          <p className="text-sm font-bold text-red mb-5">제한 시간: {start}~{end}</p>
        )}
        <Link href="/" className="inline-block bg-navy text-white font-bold text-sm rounded-lg px-6 py-3">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
