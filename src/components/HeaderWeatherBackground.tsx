"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type WeatherOk = { ok: true; temp: number; sky: "clear" | "cloudy"; pty: "none" | "rain" | "rainsnow" | "snow" | "shower" };
type WeatherState = WeatherOk | { ok: false } | null;
type Variant = "clear" | "cloudy" | "rain" | "snow";

function getVariant(pty: WeatherOk["pty"], sky: WeatherOk["sky"]): Variant {
  if (pty === "rain" || pty === "shower") return "rain";
  if (pty === "snow" || pty === "rainsnow") return "snow";
  return sky;
}

// 맑음 — "별 장식"이 아니라 오른쪽 위에서 은은하게 스며드는 자연광 느낌만 그라데이션/
// 블러로 표현한다(뚜렷한 원·아이콘 모양은 전혀 그리지 않는다). 색은 강한 노란색이
// 아니라 아주 옅은 크림색/흰색만 쓴다.
// 빛 주변에 아주 투명하게 떠다니는 작은 빛 번짐(bokeh) — driftX/driftY는 각자 아주
// 미세하게 왕복 이동하는 거리(px)다. animation-direction:alternate로 왕복시키므로
// 처음/끝이 자연스럽게 이어지는(seamless) 루프가 된다.
const SUN_BOKEH = [
  { top: 10, right: 8, size: 64, opacity: 0.3, duration: 16, delay: -3, driftX: 10, driftY: 8 },
  { top: 26, right: 24, size: 42, opacity: 0.22, duration: 20, delay: -9, driftX: -8, driftY: 9 },
  { top: 4, right: 32, size: 30, opacity: 0.18, duration: 14, delay: -6, driftX: 7, driftY: -6 },
  { top: 34, right: 10, size: 50, opacity: 0.2, duration: 22, delay: -13, driftX: -7, driftY: 6 },
  { top: 16, right: 44, size: 24, opacity: 0.16, duration: 18, delay: -8, driftX: 6, driftY: 7 },
];
// 맑은 날에도 아주 희미하게 지나가는 높은 구름(권운) 느낌 — 거의 흰색에 가깝고 매우
// 투명해서 깔끔한 디자인을 해치지 않는다. 기존 cloud-drift 애니메이션(좌→우, 양 끝이
// 화면 밖이라 루프 지점이 안 보임)을 그대로 재사용한다.
const CLEAR_WISPS = [
  { top: 6, size: 240, duration: 140, delay: -25, opacity: 0.12 },
  { top: 20, size: 180, duration: 170, delay: -80, opacity: 0.09 },
];

// 크기·속도가 서로 다른 구름 5개가 좌→우로 천천히 가로지른다(delay를 음수로 줘서
// 처음부터 서로 다른 위치에서 시작한 것처럼 보이게 한다).
const CLOUD_CONFIGS = [
  { top: 8, size: 170, duration: 70, delay: -10, opacity: 0.9 },
  { top: 40, size: 230, duration: 95, delay: -45, opacity: 0.85 },
  { top: 18, size: 190, duration: 80, delay: -62, opacity: 0.88 },
  { top: 55, size: 210, duration: 110, delay: -20, opacity: 0.82 },
  { top: 2, size: 140, duration: 60, delay: -32, opacity: 0.9 },
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
        <>
          {/* 넓게 퍼지는 은은한 wash + 코너 쪽에 살짝 더 밝은 핵, 두 겹을 겹쳐서
              자연스러운 광원처럼 보이게 한다. 둘 다 아주 느린 pulse(숨쉬듯 밝기가
              오르내림)로 고정된 아이콘처럼 안 보이게 한다. */}
          <div
            className="absolute -top-20 -right-20 w-[80%] h-full rounded-full animate-weather-bg-sun-pulse motion-reduce:animate-none motion-reduce:opacity-70"
            style={{
              background: "radial-gradient(circle, rgba(255,251,235,0.4) 0%, rgba(255,248,220,0.16) 45%, rgba(255,248,220,0) 75%)",
            }}
          />
          <div
            className="absolute -top-6 -right-6 w-[45%] h-[65%] rounded-full animate-weather-bg-sun-pulse motion-reduce:animate-none motion-reduce:opacity-70"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,250,235,0.22) 50%, rgba(255,250,235,0) 80%)",
              animationDelay: "-4s",
            }}
          />
          {/* 아주 투명한 빛 번짐(bokeh) 몇 개가 미세하게 왕복하며 떠다닌다. */}
          {SUN_BOKEH.map((b, i) => (
            <div
              key={i}
              className={`absolute rounded-full animate-weather-bg-bokeh-float motion-reduce:animate-none ${i >= 3 ? "hidden sm:block" : ""}`}
              style={
                {
                  top: `${b.top}%`,
                  right: `${b.right}%`,
                  width: b.size,
                  height: b.size,
                  opacity: b.opacity,
                  background: "radial-gradient(circle, rgba(255,253,245,0.9) 0%, rgba(255,253,245,0) 70%)",
                  filter: "blur(2px)",
                  animationDuration: `${b.duration}s`,
                  animationDelay: `${b.delay}s`,
                  "--drift-x": `${b.driftX}px`,
                  "--drift-y": `${b.driftY}px`,
                } as CSSProperties
              }
            />
          ))}
          {/* 맑은 날에도 아주 희미하게 지나가는 높은 구름(권운) */}
          {CLEAR_WISPS.map((w, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-weather-bg-cloud-drift motion-reduce:animate-none motion-reduce:left-1/3"
              style={{
                top: `${w.top}%`,
                width: w.size,
                height: w.size * 0.22,
                opacity: w.opacity,
                background: "white",
                filter: "blur(14px)",
                animationDuration: `${w.duration}s`,
                animationDelay: `${w.delay}s`,
              }}
            />
          ))}
        </>
      )}

      {variant === "cloudy" &&
        CLOUD_CONFIGS.map((c, i) => (
          <div
            key={i}
            className={`absolute animate-weather-bg-cloud-drift motion-reduce:animate-none motion-reduce:left-1/4 ${
              i >= 3 ? "hidden sm:block" : ""
            }`}
            style={{
              top: `${c.top}%`,
              width: c.size,
              height: c.size * 0.6,
              opacity: c.opacity,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          >
            {/* 뭉게구름 실루엣 — 크기가 다른 타원 여러 개를 겹쳐 윤곽을 만들고, 위는 밝고
                아래는 살짝 그늘진 그라데이션으로 입체감을 준 뒤 아주 살짝만 블러 처리해서
                (윤곽 자체는 또렷하게 남기고 경계 이음매만 부드럽게) 사진 속 뭉게구름
                느낌을 낸다 — 안개처럼 형체가 없는 것과는 다르게 "구름"으로 알아볼 수 있게. */}
            <svg viewBox="0 0 100 60" width="100%" height="100%" style={{ filter: "blur(1.5px)" }}>
              <defs>
                <linearGradient id={`cloudGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#d6dee8" />
                </linearGradient>
              </defs>
              <ellipse cx="45" cy="46" rx="32" ry="12" fill={`url(#cloudGrad${i})`} />
              <ellipse cx="28" cy="38" rx="20" ry="16" fill={`url(#cloudGrad${i})`} />
              <ellipse cx="50" cy="28" rx="22" ry="18" fill={`url(#cloudGrad${i})`} />
              <ellipse cx="68" cy="36" rx="18" ry="15" fill={`url(#cloudGrad${i})`} />
            </svg>
          </div>
        ))}

      {variant === "rain" &&
        raindrops.map((r, i) => (
          <span
            key={i}
            className={`absolute w-[2px] h-4 rounded-full bg-[#bfdbfe] animate-weather-bg-rainfall motion-reduce:animate-none motion-reduce:opacity-0 ${
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
