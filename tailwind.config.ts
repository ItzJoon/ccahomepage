import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#16233F",
        blue: "#2C4A7C",
        red: "#C1272D",
        gold: "#B8790F",
        teal: "#1E8F6F",
        bg: "#F7F8FB",
        border: "#E5E8EF",
        muted: "#6B7280",
        // 홈 화면/헤더/푸터의 "green" 테마용 (src/lib/homeTheme.ts 참고)
        ink: "#111111",
        ccahGreen: "#1D6F42",
        ccahGreenLight: "#E8F5EE",
        ccahGreenBright: "#4ABA78",
        // 홈 화면/헤더/푸터의 "apple" 테마용 (Figma "CCA-Hompage" 디자인 그대로)
        appleBlue: "#2563eb",
        appleBg: "#f2f2f7",
        appleInk: "#111827",
        appleMuted: "#6b7280",
        appleBorder: "#e5e7eb",
        appleAmber: "#d97706",
        appleGreen: "#10b981",
      },
      fontFamily: {
        serif: ["'Noto Serif KR'", "serif"],
        sans: ["'Noto Sans KR'", "sans-serif"],
        // 홈 화면/헤더/푸터의 "green" 테마 헤딩용 (src/lib/homeTheme.ts 참고)
        jua: ["'Jua'", "'Noto Sans KR'", "sans-serif"],
        // "apple" 테마의 히어로 제목용 손글씨체 (Figma 디자인 그대로)
        caveat: ["'Caveat'", "cursive"],
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
