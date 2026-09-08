"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type WeatherOk = { ok: true; temp: number; sky: "clear" | "cloudy"; pty: "none" | "rain" | "rainsnow" | "snow" | "shower" };
type WeatherState = WeatherOk | { ok: false } | null;
type Variant = "clear" | "cloudy" | "rain" | "snow";

function getVariant(pty: WeatherOk["pty"], sky: WeatherOk["sky"]): Variant {
  if (pty === "rain" || pty === "shower") return "rain";
  if (pty === "snow" || pty === "rainsnow") return "snow";
  return sky;
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const FOG_CONFIGS = [
  { top: 15, left: 8, size: 90, duration: 20, delay: -4, opacity: 0.5 },
  { top: 45, left: 32, size: 130, duration: 26, delay: -14, opacity: 0.4 },
  { top: 20, left: 58, size: 100, duration: 22, delay: -8, opacity: 0.45 },
  { top: 55, left: 78, size: 110, duration: 28, delay: -18, opacity: 0.4 },
  { top: 8, left: 82, size: 70, duration: 18, delay: -2, opacity: 0.5 },
];

// 눈 쌓임을 가로 여러 구간(bucket)으로 나눠서, 실제로 눈송이가 많이 떨어진 구간이 더
// 높이 쌓이도록 한다. 각 구간은 SVG viewBox 기준 0(안 쌓임)~SNOW_BUCKET_MAX(이 구간의
// 한계, 이 값에 도달하면 그 구간은 더 이상 안 쌓인다) 사이 값을 갖는다.
const BUCKET_COUNT = 20;
const SNOW_BUCKET_MAX = 20;
const SNOW_BUCKET_INCREMENT = 0.5;
const SNOW_BUCKETS_KEY = "headerWeatherSnowBuckets";
const SNOW_PERSIST_INTERVAL_MS = 2000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadStoredBuckets(): number[] {
  try {
    const raw = sessionStorage.getItem(SNOW_BUCKETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; buckets: number[] };
      if (parsed.date === todayKey() && Array.isArray(parsed.buckets) && parsed.buckets.length === BUCKET_COUNT) {
        return parsed.buckets;
      }
    }
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) — 0부터 시작
  }
  return new Array(BUCKET_COUNT).fill(0);
}

// 인접 구간끼리 높이 차이가 너무 튀지 않도록 3점 가중평균으로 살짝 부드럽게 만든다.
function smoothBuckets(buckets: number[]): number[] {
  return buckets.map((v, i) => {
    const prev = buckets[i - 1] ?? v;
    const next = buckets[i + 1] ?? v;
    return (prev + v * 2 + next) / 4;
  });
}

// 구간별 높이 배열을 부드러운 곡선(연속된 2차 베지어)으로 잇는 SVG path를 만든다 —
// 각 점을 다음 점과의 중점까지 곡선으로 이어가는 표준적인 "smooth curve through points"
// 기법이라 임의의 높이 배열에도 안전하게 매끄러운 형태가 나온다.
function bucketsToPath(buckets: number[]): string {
  const n = buckets.length;
  const step = 100 / n;
  const points = buckets.map((v, i) => ({ x: (i + 0.5) * step, y: SNOW_BUCKET_MAX - Math.min(v, SNOW_BUCKET_MAX) }));
  let d = `M 0,${points[0].y} L ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const midX = (cur.x + next.x) / 2;
    const midY = (cur.y + next.y) / 2;
    d += ` Q ${cur.x},${cur.y} ${midX},${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x},${last.y} L 100,${last.y} L 100,${SNOW_BUCKET_MAX} L 0,${SNOW_BUCKET_MAX} Z`;
  return d;
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
  const [, setRenderTick] = useState(0);
  const bucketsRef = useRef<number[]>(new Array(BUCKET_COUNT).fill(0));

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

  // 눈 쌓임 진행도를 세션(같은 탭) + 오늘 날짜 기준으로 기억한다. 새 탭/새 세션으로
  // 열거나 날짜가 바뀌면 저장된 값이 "오늘"과 안 맞으므로 0부터 다시 시작한다.
  useEffect(() => {
    bucketsRef.current = loadStoredBuckets();
    setRenderTick((t) => t + 1);
    const timer = setInterval(() => {
      try {
        sessionStorage.setItem(SNOW_BUCKETS_KEY, JSON.stringify({ date: todayKey(), buckets: bucketsRef.current }));
      } catch {
        // 무시 — 저장 안 돼도 이번 세션 내 애니메이션 자체는 계속 동작한다
      }
      setRenderTick((t) => t + 1);
    }, SNOW_PERSIST_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const handleSnowLanding = (bucketIndex: number) => {
    const cur = bucketsRef.current[bucketIndex] ?? 0;
    if (cur >= SNOW_BUCKET_MAX) return;
    bucketsRef.current = bucketsRef.current.map((v, i) => (i === bucketIndex ? Math.min(SNOW_BUCKET_MAX, v + SNOW_BUCKET_INCREMENT) : v));
  };

  // 빗줄기/눈송이의 x 위치·속도·지연은 마운트 시 한 번만 뽑아서 고정한다(매 렌더마다
  // 위치가 바뀌면 오히려 부자연스럽다).
  const raindrops = useMemo(
    () => Array.from({ length: 22 }, () => ({ left: Math.random() * 100, duration: 0.7 + Math.random() * 0.6, delay: Math.random() * 2 })),
    []
  );
  const snowflakes = useMemo(
    () =>
      Array.from({ length: 16 }, () => {
        const left = Math.random() * 100;
        return {
          left,
          bucket: Math.min(BUCKET_COUNT - 1, Math.floor((left / 100) * BUCKET_COUNT)),
          size: 3 + Math.random() * 4,
          duration: 5 + Math.random() * 4,
          delay: Math.random() * 6,
        };
      }),
    []
  );

  let variant: Variant | null = null;
  if (debugVariant) variant = debugVariant;
  else if (weather && weather.ok) variant = getVariant(weather.pty, weather.sky);

  if (!variant) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {variant === "clear" && (
        <svg className="absolute top-2 right-2 w-20 h-20 sm:w-28 sm:h-28" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="headerSunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(251,191,36,0.9)" />
              <stop offset="60%" stopColor="rgba(251,191,36,0.35)" />
              <stop offset="100%" stopColor="rgba(251,191,36,0)" />
            </radialGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="url(#headerSunGlow)"
            className="animate-weather-bg-glow motion-reduce:animate-none motion-reduce:opacity-30"
          />
          {RAY_ANGLES.map((angle, i) => (
            <rect
              key={angle}
              x="47"
              y="12"
              width="6"
              height="14"
              rx="2"
              fill="#f59e0b"
              transform={`rotate(${angle} 50 50)`}
              className="animate-weather-bg-ray motion-reduce:animate-none motion-reduce:opacity-70"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
          <circle cx="50" cy="50" r="16" fill="#fbbf24" />
        </svg>
      )}

      {variant === "cloudy" &&
        FOG_CONFIGS.map((f, i) => (
          <div
            key={i}
            className={`absolute animate-weather-bg-fog motion-reduce:animate-none ${i >= 3 ? "hidden sm:block" : ""}`}
            style={{
              top: `${f.top}%`,
              left: `${f.left}%`,
              width: f.size,
              height: f.size * 0.65,
              filter: "blur(10px)",
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            }}
          >
            {/* 뚜렷한 윤곽 없이 여러 원을 겹쳐서 blur로 뭉개면 뭉게뭉게한 안개 덩어리처럼 보인다. */}
            <div className="absolute inset-0 rounded-full bg-appleMuted" style={{ opacity: f.opacity }} />
            <div className="absolute left-[18%] top-0 w-[65%] h-[80%] rounded-full bg-appleMuted" style={{ opacity: f.opacity }} />
            <div className="absolute right-[8%] bottom-0 w-[55%] h-[75%] rounded-full bg-appleMuted" style={{ opacity: f.opacity }} />
          </div>
        ))}

      {variant === "rain" &&
        raindrops.map((r, i) => (
          <span
            key={i}
            className={`absolute w-[2px] h-4 rounded-full bg-appleBlue animate-weather-bg-rainfall motion-reduce:animate-none motion-reduce:opacity-0 ${
              i >= 12 ? "hidden sm:block" : ""
            }`}
            style={{ left: `${r.left}%`, top: "-40px", animationDuration: `${r.duration}s`, animationDelay: `${r.delay}s` }}
          />
        ))}

      {variant === "snow" && (
        <>
          {snowflakes.map((s, i) => (
            <span
              key={i}
              // 헤더 배경이 흰색이라 순백색 눈송이는 거의 안 보인다 — 옅은 하늘색 톤 +
              // 그림자로 구별되게 한다. onAnimationIteration으로 한 번 낙하를 마칠
              // 때마다(=바닥에 도달할 때마다) 배정된 구간의 쌓임 높이를 조금씩 올린다.
              className={`absolute rounded-full bg-[#dbeafe] shadow-[0_0_3px_rgba(37,99,235,0.35)] animate-weather-bg-snowfall motion-reduce:animate-none motion-reduce:opacity-0 ${
                i >= 9 ? "hidden sm:block" : ""
              }`}
              style={{
                left: `${s.left}%`,
                top: "-16px",
                width: s.size,
                height: s.size,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              }}
              onAnimationIteration={() => handleSnowLanding(s.bucket)}
            />
          ))}
          <svg
            className="absolute bottom-0 left-0 w-full"
            style={{ height: "18%" }}
            viewBox={`0 0 100 ${SNOW_BUCKET_MAX}`}
            preserveAspectRatio="none"
          >
            {/* 흰 배경 위에서도 구별되도록 옅은 하늘색 톤으로 채우고, 윗변에 살짝 진한
                선을 둘러 경계를 잡아준다(순백색 fill은 흰 카드 배경과 구분이 안 됨).
                구간별 높이를 3점 평균으로 부드럽게 만든 뒤 연속 베지어 곡선으로 이어서
                울퉁불퉁하되 튀지 않는 눈 더미 모양을 만든다. */}
            <path d={bucketsToPath(smoothBuckets(bucketsRef.current))} fill="#eef2ff" fillOpacity="0.95" stroke="#c7d2fe" strokeWidth="0.6" />
          </svg>
        </>
      )}
    </div>
  );
}
