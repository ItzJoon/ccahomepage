/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    // (site)/layout.tsx가 로그인 쿠키를 읽어서 항상 동적 렌더링되는데, 기본값(동적
    // 세그먼트는 클라이언트 라우터 캐시 0초)이라 하단 탭바로 홈/공지사항/Q&A/게시판/
    // 마이페이지를 오갈 때마다 이 레이아웃의 프로필/배너/팝업/패치노트 조회
    // (Promise.all)가 매번 새로 서버 왕복을 해서 탭 전환이 버벅이게 느껴졌다.
    // 배너/팝업/뱃지처럼 즉시 반영돼야 하는 것들은 이미 realtime 구독으로 따로
    // 처리하고 있어(레이아웃 재조회와 무관하게 즉시 반영됨), 레이아웃 자체는 30초
    // 정도 재사용해도 안전하다.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
