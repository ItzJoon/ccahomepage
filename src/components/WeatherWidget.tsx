"use client";

import { useEffect, useState } from "react";

type WeatherOk = { ok: true; temp: number; sky: "clear" | "cloudy"; pty: "none" | "rain" | "rainsnow" | "snow" | "shower" };
type WeatherState = WeatherOk | { ok: false } | null;

/**
 * 홈 화면 히어로 영역에 붙는 실시간 날씨. /api/weather(서버에서 기상청 API를 캐싱해
 * 대신 호출)를 조회해서 기온 + 날씨별 은은한 아이콘 애니메이션을 보여준다. 조회에
 * 실패하거나 아직 안 왔으면 그냥 아무것도 렌더링하지 않는다 — 날씨 때문에 홈 화면이
 * 깨지거나 빈 자리가 어색하게 남으면 안 되므로.
 */
export default function WeatherWidget() {
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

  const variant = getVariant(weather.pty, weather.sky);

  return (
    <div className="flex items-center gap-1.5 shrink-0" title={`현재 기온 ${weather.temp}°C`}>
      <div className="relative w-8 h-8 shrink-0 flex items-center justify-center text-2xl leading-none">
        {variant === "clear" && <span className="inline-block animate-weather-spin">☀️</span>}
        {variant === "cloudy" && <span className="inline-block animate-weather-drift">☁️</span>}
        {variant === "rain" && (
          <>
            <span>🌧️</span>
            <span className="absolute inset-x-0 -bottom-0.5 flex justify-center gap-1 pointer-events-none">
              {[0, 0.3, 0.6].map((delay) => (
                <span key={delay} className="w-[2px] h-[6px] bg-blue-400 rounded-full animate-weather-drop" style={{ animationDelay: `${delay}s` }} />
              ))}
            </span>
          </>
        )}
        {variant === "snow" && (
          <>
            <span>🌨️</span>
            <span className="absolute inset-x-0 -bottom-0.5 flex justify-center gap-1.5 pointer-events-none text-[9px]">
              {[0, 0.4, 0.8].map((delay) => (
                <span key={delay} className="animate-weather-drop" style={{ animationDelay: `${delay}s` }}>
                  ❄
                </span>
              ))}
            </span>
          </>
        )}
      </div>
      <span className="hidden sm:inline text-sm font-bold shrink-0">{weather.temp}°C</span>
    </div>
  );
}

function getVariant(pty: WeatherOk["pty"], sky: WeatherOk["sky"]): "clear" | "cloudy" | "rain" | "snow" {
  if (pty === "rain" || pty === "shower") return "rain";
  if (pty === "snow" || pty === "rainsnow") return "snow";
  return sky;
}
