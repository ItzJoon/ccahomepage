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
      },
      fontFamily: {
        serif: ["'Noto Serif KR'", "serif"],
        sans: ["'Noto Sans KR'", "sans-serif"],
        // 홈 화면/헤더/푸터의 "green" 테마 헤딩용 (src/lib/homeTheme.ts 참고)
        jua: ["'Jua'", "'Noto Sans KR'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
