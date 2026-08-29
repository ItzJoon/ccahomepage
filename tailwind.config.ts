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
    },
  },
  plugins: [],
};
export default config;
