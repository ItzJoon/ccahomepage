"use client";

import { useEffect, useMemo, useState } from "react";

type WeatherOk = { ok: true; temp: number; sky: "clear" | "cloudy"; pty: "none" | "rain" | "rainsnow" | "snow" | "shower" };
type WeatherState = WeatherOk | { ok: false } | null;
type Variant = "clear" | "cloudy" | "rain" | "snow";

function getVariant(pty: WeatherOk["pty"], sky: WeatherOk["sky"]): Variant {
  if (pty === "rain" || pty === "shower") return "rain";
  if (pty === "snow" || pty === "rainsnow") return "snow";
  return sky;
}

// 눈 쌓임 진행도를 세션스토리지에 "오늘 날짜 + 시작 시각"으로 기록해둔다. 같은 탭에서
// 새로고침해도 자연스럽게 이어서 쌓이지만, 새 탭/새 세션으로 열거나 날짜가 바뀌면
// 저장된 값이 "오늘"과 안 맞거나 없으므로 낮은 높이(0)부터 다시 시작한다.
const SNOW_STORAGE_KEY = "headerWeatherSnowAccum";
const SNOW_MAX_HEIGHT_PCT = 18; // 헤더(부모 컨테이너) 높이 대비 최대 비율
const SNOW_RAMP_MINUTES = 12; // 이 시간에 걸쳐 서서히 최대 높이까지 쌓인다

const CLOUD_CONFIGS = [
  { top: 12, size: 64, duration: 60, delay: -10, opacity: 0.22 },
  { top: 35, size: 96, duration: 90, delay: -40, opacity: 0.18 },
  { top: 55, size: 52, duration: 75, delay: -20, opacity: 0.2 },
  { top: 20, size: 110, duration: 120, delay: -70, opacity: 0.15 },
  { top: 68, size: 70, duration: 100, delay: -55, opacity: 0.17 },
];

function Cloud({ top, size, duration, delay, opacity, hideOnMobile }: (typeof CLOUD_CONFIGS)[number] & { hideOnMobile?: boolean }) {
  return (
    <div
      className={`absolute animate-weather-bg-cloud motion-reduce:animate-none motion-reduce:left-1/4 ${hideOnMobile ? "hidden sm:block" : ""}`}
      style={{ top: `${top}%`, width: size, height: size * 0.55, animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
    >
      <div className="relative w-full h-full" style={{ opacity }}>
        <div className="absolute inset-x-[15%] bottom-0 h-[70%] rounded-full bg-appleInk" />
        <div className="absolute left-0 bottom-0 w-[55%] h-[55%] rounded-full bg-appleInk" />
        <div className="absolute right-0 bottom-0 w-[60%] h-[65%] rounded-full bg-appleInk" />
      </div>
    </div>
  );
}

/**
 * 헤더(히어로 카드) 전체 배경에 까는 실험적 날씨 애니메이션. 기존 WeatherWidget과
 * 완전히 독립적으로 /api/weather를 조회하며(날씨 판정 로직은 그대로, 렌더링 위치만
 * 배경 전체로 확장), NEXT_PUBLIC_ENABLE_HEADER_WEATHER_BG가 켜져 있을 때만 Header 쪽에서
 * 조건부로 렌더링된다. 조회 실패/미완료 시에는 아무것도 그리지 않는다.
 */
export default function HeaderWeatherBackground() {
  const [weather, setWeather] = useState<WeatherState>(null);
  const [debugVariant, setDebugVariant] = useState<Variant | null>(null);
  const [snowHeightPct, setSnowHeightPct] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/weather")
      .then((res) => res.json())
      .then((data) => {
        if (active) setWeather(data);
      })
      .catch(() => {
        if (active) setWeather({ ok: false });
      });
    return () => {
      active = false;
    };
  }, []);

  // 개발 서버에서만 ?debugWeather=clear|cloudy|rain|snow 로 상태를 강제할 수 있게 한다
  // (기상청 API 키가 로컬에 없거나, 실제로 그 날씨가 아닐 때도 눈으로 확인하기 위함).
  // next build/start(프로덕션 빌드)에서는 NODE_ENV가 항상 production이라 항상 비활성.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const v = new URLSearchParams(window.location.search).get("debugWeather");
    if (v === "clear" || v === "cloudy" || v === "rain" || v === "snow") setDebugVariant(v);
  }, []);

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    let startedAt = Date.now();
    try {
      const raw = sessionStorage.getItem(SNOW_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { date: string; startedAt: number };
        if (parsed.date === todayKey) startedAt = parsed.startedAt;
      }
      sessionStorage.setItem(SNOW_STORAGE_KEY, JSON.stringify({ date: todayKey, startedAt }));
    } catch {
      // 프라이빗 모드 등으로 sessionStorage를 못 쓰면 이번 페이지 진입 기준으로만 쌓인다.
    }

    const compute = () => {
      const elapsedMin = (Date.now() - startedAt) / 60000;
      setSnowHeightPct(Math.min(SNOW_MAX_HEIGHT_PCT, (elapsedMin / SNOW_RAMP_MINUTES) * SNOW_MAX_HEIGHT_PCT));
    };
    compute();
    const timer = setInterval(compute, 5000);
    return () => clearInterval(timer);
  }, []);

  // 빗방울/물줄기/눈송이의 x 위치는 매번 랜덤해야 자연스러우므로 마운트 시 한 번만 뽑아서
  // 고정한다(리렌더마다 위치가 바뀌면 오히려 부자연스럽다).
  const raindrops = useMemo(
    () => Array.from({ length: 22 }, () => ({ left: Math.random() * 100, duration: 0.7 + Math.random() * 0.6, delay: Math.random() * 2 })),
    []
  );
  const streaks = useMemo(
    () => Array.from({ length: 7 }, () => ({ left: Math.random() * 100, duration: 2 + Math.random() * 1.4, delay: Math.random() * 3 })),
    []
  );
  const snowflakes = useMemo(
    () =>
      Array.from({ length: 16 }, () => ({
        left: Math.random() * 100,
        size: 3 + Math.random() * 4,
        duration: 5 + Math.random() * 4,
        delay: Math.random() * 6,
      })),
    []
  );

  let variant: Variant | null = null;
  if (debugVariant) variant = debugVariant;
  else if (weather && weather.ok) variant = getVariant(weather.pty, weather.sky);

  if (!variant) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {variant === "clear" && (
        <div
          className="absolute -top-1/3 -right-1/4 w-2/3 h-full rounded-full animate-weather-bg-glow motion-reduce:animate-none motion-reduce:opacity-30"
          style={{ background: "radial-gradient(circle, rgba(217,119,6,0.35) 0%, rgba(217,119,6,0) 70%)" }}
        />
      )}

      {(variant === "cloudy" || variant === "rain" || variant === "snow") &&
        CLOUD_CONFIGS.map((c, i) => <Cloud key={i} {...c} hideOnMobile={i >= 3} />)}

      {variant === "rain" && (
        <>
          {raindrops.map((r, i) => (
            <span
              key={i}
              className={`absolute top-0 w-[2px] h-[10px] rounded-full bg-appleBlue animate-weather-bg-rain motion-reduce:animate-none motion-reduce:opacity-0 ${
                i >= 12 ? "hidden sm:block" : ""
              }`}
              style={{ left: `${r.left}%`, animationDuration: `${r.duration}s`, animationDelay: `${r.delay}s` }}
            />
          ))}
          {streaks.map((s, i) => (
            <span
              key={i}
              className={`absolute top-0 w-px h-16 animate-weather-bg-streak motion-reduce:animate-none motion-reduce:opacity-0 ${
                i >= 4 ? "hidden sm:block" : ""
              }`}
              style={{
                left: `${s.left}%`,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
                background: "linear-gradient(to bottom, rgba(37,99,235,0.3), rgba(37,99,235,0))",
              }}
            />
          ))}
        </>
      )}

      {variant === "snow" && (
        <>
          {snowflakes.map((s, i) => (
            <span
              key={i}
              // 헤더 배경이 흰색이라 순백색 눈송이는 거의 안 보인다 — 옅은 하늘색 톤 +
              // 그림자로 구별되게 한다.
              className={`absolute top-0 rounded-full bg-[#dbeafe] shadow-[0_0_3px_rgba(37,99,235,0.35)] animate-weather-bg-snow motion-reduce:animate-none motion-reduce:opacity-0 ${
                i >= 9 ? "hidden sm:block" : ""
              }`}
              style={{ left: `${s.left}%`, width: s.size, height: s.size, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }}
            />
          ))}
          <svg
            className="absolute bottom-0 left-0 w-full transition-[height] duration-1000 ease-linear"
            style={{ height: `${snowHeightPct}%` }}
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
          >
            {/* 흰 배경 위에서도 구별되도록 옅은 하늘색 톤으로 채우고, 윗변에 살짝 진한
                선을 둘러 경계를 잡아준다(순백색 fill은 흰 카드 배경과 구분이 안 됨). */}
            <path
              d="M0,8 Q 8,2 16,8 T 32,8 T 48,8 T 64,8 T 80,8 T 100,8 V20 H0 Z"
              fill="#eef2ff"
              fillOpacity="0.95"
              stroke="#c7d2fe"
              strokeWidth="0.6"
            />
          </svg>
        </>
      )}
    </div>
  );
}
