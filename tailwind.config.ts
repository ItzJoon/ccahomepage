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
        // 헤더 배경 날씨 애니메이션 전용(HeaderWeatherBackground.tsx 참고, 실험적/로컬
        // 전용 기능 — NEXT_PUBLIC_ENABLE_HEADER_WEATHER_BG). 위 weather-* 는 작은 위젯
        // 아이콘용이라 그대로 두고, 배경 전체에 깔리는 큰 요소들은 별도 이름으로 분리했다.
        // 맑음 — 자연광 wash/핵이 아주 느리게 숨쉬듯 밝아졌다 옅어진다(고정된
        // 아이콘처럼 안 보이게). 0%/100%가 같은 값이라 반복돼도 이음새가 안 보인다.
        "weather-bg-sun-pulse": {
          "0%, 100%": { opacity: "0.7", transform: "scale(0.96)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        // 맑음 — 빛 번짐(bokeh)이 아주 미세하게 왕복 이동한다. alternate 방향으로
        // 재생해서 0%->100%->0%가 자연스럽게 이어지는 seamless 루프가 된다.
        "weather-bg-bokeh-float": {
          "0%": { transform: "translate(0px, 0px)" },
          "100%": { transform: "translate(var(--drift-x, 8px), var(--drift-y, 8px))" },
        },
        // 흐림 — 뭉게구름이 화면 왼쪽 바깥에서 오른쪽 바깥까지 천천히 가로지른다(각
        // 구름마다 duration/delay가 달라서 서로 다른 속도로 어긋나게 지나간다).
        "weather-bg-cloud-drift": {
          "0%": { left: "-30%", opacity: "0.5" },
          "50%": { opacity: "0.85" },
          "100%": { left: "130%", opacity: "0.5" },
        },
        // 비 — 뷰포트 위쪽 바깥(top:-40px, 고정)에서 이미 낙하 중인 상태로 시작해서
        // 일직선으로 곧장 떨어진다.
        "weather-bg-rainfall": {
          "0%": { transform: "translateY(0px)", opacity: "0" },
          "10%": { opacity: "0.55" },
          "90%": { opacity: "0.55" },
          "100%": { transform: "translateY(380px)", opacity: "0" },
        },
        // 눈 — 위쪽 바깥에서 시작해 좌우로 흔들리며(sway) 낙하. 실제 쌓임 높이는 각
        // 눈송이의 onAnimationIteration에서 별도로 계산한다(이 keyframe은 순수 낙하 모션만).
        "weather-bg-snowfall": {
          "0%": { transform: "translate(0px, 0px)", opacity: "0" },
          "10%": { opacity: "0.9" },
          "25%": { transform: "translate(8px, 90px)" },
          "50%": { transform: "translate(-8px, 180px)" },
          "75%": { transform: "translate(8px, 270px)" },
          "90%": { opacity: "0.9" },
          "100%": { transform: "translate(0px, 360px)", opacity: "0" },
        },
      },
      animation: {
        "confetti-fall": "confetti-fall 1.8s ease-in forwards",
        "glow-pulse": "glow-pulse 1.4s ease-in-out infinite",
        "weather-spin": "weather-spin 12s linear infinite",
        "weather-drift": "weather-drift 3.5s ease-in-out infinite",
        "weather-drop": "weather-drop 1.1s ease-in infinite",
        "weather-bg-sun-pulse": "weather-bg-sun-pulse 14s ease-in-out infinite",
        "weather-bg-bokeh-float": "weather-bg-bokeh-float 18s ease-in-out infinite alternate",
        "weather-bg-cloud-drift": "weather-bg-cloud-drift 90s linear infinite",
        "weather-bg-rainfall": "weather-bg-rainfall 1.1s linear infinite",
        "weather-bg-snowfall": "weather-bg-snowfall 7s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
