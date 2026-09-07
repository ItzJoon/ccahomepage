import { Noto_Sans_KR, Noto_Serif_KR, Jua, Caveat } from "next/font/google";

// 예전엔 globals.css의 @import url(fonts.googleapis.com/...)로 웹폰트를 불러왔는데,
// 학교 방화벽 등 특정 네트워크에서 이 CDN 접근 자체가 막히면 폰트 로딩이 통째로
// 실패해서 브라우저가 Windows 시스템 기본 한글 폰트로 대체했다 — 환경에 따라 이게
// 궁서체로 보이는 사례가 있었다. next/font는 빌드 시점에 폰트 파일을 내려받아 우리
// 서버(Vercel)에서 직접 서빙하므로, 방문자 브라우저가 fonts.googleapis.com/gstatic.com에
// 접속할 필요가 아예 없어진다.
export const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-noto-serif-kr",
  display: "swap",
});

export const jua = Jua({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-jua",
  display: "swap",
});

export const caveat = Caveat({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-caveat",
  display: "swap",
});
