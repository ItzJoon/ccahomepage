import { homeTheme as t } from "@/lib/homeTheme";

export default function Footer() {
  return (
    <footer className={`${t.footerBg} ${t.footerText} ${t.footerBorder} text-center py-4 text-sm`}>
      © 학생자치회 · 이 사이트는 관리자 페이지에서 실시간으로 관리됩니다.
    </footer>
  );
}
