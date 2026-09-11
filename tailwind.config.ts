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
        // "apple" 테마의 히어로 제목용 손글씨체 (Figma 디자인 그대로). 히어로 제목이
        // "CCHS 학생자치회"처럼 영문+한글을 한 줄에 섞어 쓰는데, Caveat엔 한글 글리프가
        // 없어서 한글 부분만 다음 폰트로 넘어간다 — 여기 한글 fallback이 없으면(예전엔
        // 바로 cursive) Windows에서 한글만 궁서체 등 예상 밖의 폰트로 떨어졌다.
        caveat: ["var(--font-caveat)", "var(--font-noto-sans-kr)", "Malgun Gothic", "Apple SD Gothic Neo", "cursive"],
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
        "weather-bg-glow": {
          "0%, 100%": { opacity: "0.15", transform: "scale(0.9)" },
          "50%": { opacity: "0.45", transform: "scale(1.15)" },
        },
        // 맑음 — 렌즈플레어풍 스파클이 살짝 커졌다 작아지며 반짝이는 연출.
        "weather-bg-sparkle": {
          "0%, 100%": { opacity: "0.85", transform: "scale(0.94)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
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
        // 슈퍼시크릿 뱃지를 남에게 보여줄 때 정체를 가리는 "연기" 배경(members/[id]
        // 페이지 참고) — 서로 다른 duration/delay로 두 겹 겹쳐서 뭉게뭉게 움직이는
        // 느낌을 낸다. 뱃지가 36px로 작아서 과하게 흔들리면 어지러워 보이므로 이동폭은
        // 작게 잡았다.
        "badge-smoke": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate(3px, -2px) scale(1.15)", opacity: "0.85" },
        },
        "badge-smoke-2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1.05)", opacity: "0.7" },
          "50%": { transform: "translate(-3px, 2px) scale(0.95)", opacity: "0.4" },
        },
      },
      animation: {
        "confetti-fall": "confetti-fall 1.8s ease-in forwards",
        "glow-pulse": "glow-pulse 1.4s ease-in-out infinite",
        "badge-smoke": "badge-smoke 4.5s ease-in-out infinite",
        "badge-smoke-2": "badge-smoke-2 5.5s ease-in-out infinite",
        "weather-spin": "weather-spin 12s linear infinite",
        "weather-drift": "weather-drift 3.5s ease-in-out infinite",
        "weather-drop": "weather-drop 1.1s ease-in infinite",
        "weather-bg-glow": "weather-bg-glow 6s ease-in-out infinite",
        "weather-bg-sparkle": "weather-bg-sparkle 2.4s ease-in-out infinite",
        "weather-bg-cloud-drift": "weather-bg-cloud-drift 90s linear infinite",
        "weather-bg-rainfall": "weather-bg-rainfall 1.1s linear infinite",
        "weather-bg-snowfall": "weather-bg-snowfall 7s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
