/**
 * 로그인/사이트 잠금/명단 차단/정지 안내 화면 전용 레이아웃 — 전부 middleware.ts가
 * 다른 페이지 대신 여기로 보내는 "출구" 화면들이다. (site)/layout.tsx 밑에 있었을 때는
 * 이 화면 하나를 보여주려고 그 레이아웃의 무거운 조회(프로필/배너/팝업/설정/테마/기능
 * 플래그/패치노트 8개 병렬 쿼리)가 매번 통째로 다시 실행됐다 — 특히 사이트 잠금
 * 중에는 막힌 요청마다 이 비용이 반복돼서 Vercel 미들웨어/함수 실행 시간이 크게
 * 튀는 원인이 됐다(각 화면 자체는 Header/Footer 등 그 레이아웃의 어떤 것도 쓰지
 * 않아서,애초에 그 레이아웃이 필요 없었다). 완전히 분리된 이 레이아웃은 어떤 DB
 * 조회도 하지 않는다.
 */
export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[1180px] mx-auto px-5 py-7 w-full">{children}</div>;
}
