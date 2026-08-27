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
      },
      fontFamily: {
        serif: ["'Noto Serif KR'", "serif"],
        sans: ["'Noto Sans KR'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
