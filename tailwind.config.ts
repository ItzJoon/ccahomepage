import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // 라이트/다크 모드(next-themes, html.dark 클래스)와 src/lib/homeTheme.ts의
        // classic/green/apple 테마(DB 저장, 관리자가 전환)는 서로 다른 축이라 색상
        // 이름 자체는 그대로 두고 실제 값만 globals.css의 CSS 변수로 옮겼다 — :root에
        // 라이트 값, .dark에 다크 값을 정의해두면 bg-navy/text-appleInk 같은 기존
        // 클래스가 코드 수정 없이도 다크모드를 자동으로 따라간다.
        navy: "var(--navy)",
        blue: "var(--blue)",
        red: "var(--red)",
        gold: "var(--gold)",
        teal: "var(--teal)",
        bg: "var(--bg)",
        border: "var(--border)",
        muted: "var(--muted)",
        // 홈 화면/헤더/푸터의 "green" 테마용 (src/lib/homeTheme.ts 참고). text-ink/60처럼
        // 투명도 접미사와 함께 쓰이므로 "R G B" 변수를 rgb(.. / <alpha-value>)로 감싼다
        // (globals.css의 --ink 정의 참고) — appleBlue도 bg-appleBlue/10 등으로 쓰여 동일하다.
        ink: "rgb(var(--ink) / <alpha-value>)",
        ccahGreen: "var(--ccah-green)",
        ccahGreenLight: "var(--ccah-green-light)",
        ccahGreenBright: "var(--ccah-green-bright)",
        // 홈 화면/헤더/푸터의 "apple" 테마용 (Figma "CCA-Hompage" 디자인 그대로)
        appleBlue: "rgb(var(--apple-blue) / <alpha-value>)",
        appleBg: "var(--apple-bg)",
        appleInk: "var(--apple-ink)",
        appleMuted: "var(--apple-muted)",
        appleBorder: "var(--apple-border)",
        appleAmber: "var(--apple-amber)",
        appleGreen: "var(--apple-green)",
        // bg-white(리터럴)를 점진적으로 대체해나가는 범용 "카드/헤더 표면" 색.
        surface: "var(--surface)",
      },
      fontFamily: {
        // next/font(src/lib/fonts.ts)가 생성하는 CSS 변수를 그대로 쓴다. CDN 로딩이
        // 막히는 등 --font-* 변수 자체가 정의되지 않는 극단적인 경우에도 궁서체 같은
        // 예상 밖의 시스템 폰트로 떨어지지 않도록 Malgun Gothic/Apple SD Gothic Neo를
        // 명시적 fallback으로 둔다.
        serif: ["var(--font-noto-serif-kr)", "Malgun Gothic", "Apple SD Gothic Neo", "serif"],
        sans: ["var(--font-noto-sans-kr)", "Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
        // 홈 화면/헤더/푸터의 "green" 테마 헤딩용 (src/lib/homeTheme.ts 참고)
        jua: ["var(--font-jua)", "var(--font-noto-sans-kr)", "Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
        // "apple" 테마의 히어로 제목용 손글씨체 (Figma 디자인 그대로)
        caveat: ["var(--font-caveat)", "cursive"],
      },
      keyframes: {
        // 슈퍼시크릿 뱃지 획득 연출 전용(BadgeCelebration.tsx 참고)
        "confetti-fall": {
          "0%": { transform: "translateY(-10px) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(340px) rotate(360deg)", opacity: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 25px 0 rgba(212,160,23,0.45)" },
          "50%": { boxShadow: "0 0 60px 12px rgba(212,160,23,0.8)" },
        },
        // 홈 화면 날씨 위젯 전용(WeatherWidget.tsx 참고) — 은은하게 헤더에 어울리는
        // 정도로만 움직이도록 각도/거리를 작게 잡았다.
        "weather-spin": { to: { transform: "rotate(360deg)" } },
        "weather-drift": {
          "0%, 100%": { transform: "translateX(-3px)" },
          "50%": { transform: "translateX(3px)" },
        },
        "weather-drop": {
          "0%": { transform: "translateY(-2px)", opacity: "0" },
          "30%": { opacity: "1" },
          "100%": { transform: "translateY(9px)", opacity: "0" },
        },
      },
      animation: {
        "confetti-fall": "confetti-fall 1.8s ease-in forwards",
        "glow-pulse": "glow-pulse 1.4s ease-in-out infinite",
        "weather-spin": "weather-spin 12s linear infinite",
        "weather-drift": "weather-drift 3.5s ease-in-out infinite",
        "weather-drop": "weather-drop 1.1s ease-in infinite",
      },
    },
  },
  plugins: [],
};
export default config;
