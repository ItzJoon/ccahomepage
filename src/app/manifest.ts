import type { MetadataRoute } from "next";

// Next.js가 이 파일을 /manifest.webmanifest로 자동 서빙하고 <link rel="manifest">도
// 알아서 붙여준다(icon.png/apple-icon.png와 같은 파일 컨벤션) — layout.tsx의
// metadata에 따로 등록할 필요 없다. 이걸로 스마트폰에서 "홈 화면에 추가"를 누르면
// 브라우저 주소창 없이 아이콘만으로 실행되는 PWA가 된다(진짜 네이티브 앱은 아니지만
// 앱스토어 없이 무료로 바로 쓸 수 있는 방식).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "중앙기독고등학교 학생자치회",
    short_name: "학생자치회",
    description: "학생자치회 공식 홈페이지 — 공지사항, 부서 소개, 학사일정, 규정 등을 확인하세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16233f",
    lang: "ko",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
