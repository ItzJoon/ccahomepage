"use client";

import { useEffect, useState } from "react";

type WeatherOk = { ok: true; temp: number; sky: "clear" | "cloudy"; pty: "none" | "rain" | "rainsnow" | "snow" | "shower" };
type WeatherState = WeatherOk | { ok: false } | null;

/**
 * 헤더 배경 날씨 애니메이션(HeaderWeatherBackground) 모드에서 히어로 제목 오른쪽에
 * 기온만 크게 보여준다. HeaderWeatherBackground는 순수 배경 레이어라서(absolute
 * inset-0, pointer-events-none) 제목과 같은 flex 줄에 넣을 수 없어 이 배경 모드가
 * 켜지면 WeatherWidget의 아이콘+기온 표시가 통째로 사라졌었다 — 배경 애니메이션이
 * 날씨 종류(맑음/흐림/비/눈)는 이미 보여주므로 여기서는 기온만 담당한다.
 * WeatherWidget/HeaderWeatherBackground와 마찬가지로 /api/weather를 독립적으로
 * 조회하고, 조회 실패/미완료 시에는 아무것도 렌더링하지 않는다.
 */
export default function HeaderWeatherTemp() {
  const [weather, setWeather] = useState<WeatherState>(null);

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

  if (!weather || !weather.ok) return null;

  return (
    // 맑음(별 모양 렌즈플레어)/구름/비/눈 배경 애니메이션이 바로 이 자리(카드 우측 상단)에
    // 겹치는데, 배경마다 밝기·색이 달라 글자색을 테마에서 물려받으면(다른 위젯들처럼) 어떤
    // 날씨에서는 거의 안 보인다. 뒤판(scrim) 없이 흰 글자 + 짙은 그림자만으로, 배경이 뭐가
    // 오든 라이트/다크 모드와 무관하게 또렷하게 보이도록 한다.
    <div
      className="relative z-10 shrink-0 text-right text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_1px_10px_rgba(0,0,0,0.6)]"
      title={`현재 기온 ${weather.temp}°C`}
    >
      <div className="text-3xl font-bold leading-none">{weather.temp}°</div>
      <div className="text-xs mt-1">현재 기온</div>
    </div>
  );
}
