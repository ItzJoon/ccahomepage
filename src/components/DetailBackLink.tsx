"use client";

import Link from "next/link";
import { usePrevPath } from "./PrevPathProvider";

/**
 * 상세 페이지 상단에 단독으로 두는 "뒤로가기" 링크. 홈(`/`)에서 바로 들어왔으면
 * "← 홈으로"(홈으로 이동), 그 외(목록/검색/직접 링크 등)에는 이 콘텐츠의 목록 페이지로
 * 보내는 "← [목록 이름]으로"를 보여준다 — 두 경우를 나누는 기준은 "홈에서 왔는가"뿐이고,
 * 그 외 나머지 경우는 전부 같은 목록행 기본값으로 처리한다(요구사항상 동일한 결과).
 */
export default function DetailBackLink({ href, label }: { href: string; label: string }) {
  const prevPath = usePrevPath();
  const fromHome = prevPath === "/";

  return (
    <Link href={fromHome ? "/" : href} className="text-blue font-bold text-sm mb-3.5 inline-block">
      ← {fromHome ? "홈으로" : label}
    </Link>
  );
}
