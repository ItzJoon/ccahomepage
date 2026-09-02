export type DurationMode = "1h" | "6h" | "24h" | "3d" | "7d" | "custom" | "indefinite";

export const DURATION_PRESETS: { value: DurationMode; label: string; hours?: number }[] = [
  { value: "1h", label: "1시간", hours: 1 },
  { value: "6h", label: "6시간", hours: 6 },
  { value: "24h", label: "하루(24시간)", hours: 24 },
  { value: "3d", label: "3일", hours: 72 },
  { value: "7d", label: "일주일", hours: 168 },
  { value: "custom", label: "직접 종료 시각 지정" },
  { value: "indefinite", label: "수동으로 끌 때까지 계속 노출" },
];

/**
 * 알림(배너/팝업) 노출 종료 시각을 계산한다. custom은 datetime-local input의 값
 * ("YYYY-MM-DDTHH:mm" 형태, 로컬 시간)을 그대로 Date로 파싱해 ISO 문자열로 바꾼다.
 */
export function computeDisplayUntil(mode: DurationMode, customUntil: string): string | null {
  if (mode === "indefinite") return null;
  if (mode === "custom") return customUntil ? new Date(customUntil).toISOString() : null;
  const preset = DURATION_PRESETS.find((p) => p.value === mode);
  return preset?.hours ? new Date(Date.now() + preset.hours * 3600_000).toISOString() : null;
}
