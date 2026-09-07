import type { Metadata } from "next";
import MaintenanceContent from "./MaintenanceContent";

// 점검 모드 안내 화면은 실제 콘텐츠가 아니므로 검색엔진이 색인하면 안 된다 — 미들웨어가
// 이 화면으로 rewrite할 때 HTTP 상태를 503으로 내려주는 것과 별개로(그건 크롤러가 아예
// "이 URL은 지금 콘텐츠가 아니다"라고 판단하게 하는 것), 직접 /maintenance URL로 들어온
// 경우에도 노출되지 않도록 noindex를 명시한다.
export const metadata: Metadata = {
  title: "사이트 점검 중",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return <MaintenanceContent />;
}
