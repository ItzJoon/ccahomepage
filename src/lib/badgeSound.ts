import type { BadgeDef } from "@/lib/types";

// 등급별 사운드 폴더/볼륨. secret_tier는 이미 badges 테이블에 있는 값을 그대로 쓴다.
const TIER_FOLDER: Record<BadgeDef["secret_tier"], string> = {
  none: "normal",
  secret: "secret",
  super_secret: "super-secret",
};

const TIER_VOLUME: Record<BadgeDef["secret_tier"], number> = {
  none: 0.5,
  secret: 0.6,
  super_secret: 0.7,
};

// 뱃지별 전용 사운드(code.mp3) 존재 여부 캐시. 재생하는 그 순간에 존재 확인 요청을 보내면
// (실패 후 default.mp3로 재시도) 왕복 한 번만큼 소리가 늦게 시작되는 게 체감될 정도로
// 딜레이가 생긴다 — 그래서 뱃지 목록을 불러올 때(useBadges) 미리 한 번씩 HEAD 요청으로
// 확인해 여기 캐시해두고, 실제 재생 시점에는 캐시만 보고 즉시 default든 전용 사운드든
// 지연 없이 바로 재생한다.
const overrideExists = new Map<string, boolean>();

function cacheKey(folder: string, code: string) {
  return `${folder}/${code}`;
}

/** useBadges가 뱃지 목록을 불러온 직후 한 번 호출해서 전용 사운드 존재 여부를 미리 캐시해둔다. */
export function preloadBadgeSoundOverrides(badges: Pick<BadgeDef, "code" | "secret_tier">[]) {
  for (const b of badges) {
    const folder = TIER_FOLDER[b.secret_tier];
    const key = cacheKey(folder, b.code);
    if (overrideExists.has(key)) continue;
    fetch(`/sounds/badges/${folder}/${b.code}.mp3`, { method: "HEAD" })
      .then((res) => overrideExists.set(key, res.ok))
      .catch(() => overrideExists.set(key, false));
  }
}

/**
 * 뱃지 획득 효과음을 재생한다. 미리 캐시된 정보로 전용 사운드가 있다고 확인된 경우에만
 * 그 파일을 재생하고, 그 외(캐시에 없거나 없다고 확인된 경우)에는 등급 공통 default.mp3를
 * 지연 없이 바로 재생한다.
 */
export function playBadgeSound(badge: Pick<BadgeDef, "code" | "secret_tier">) {
  const folder = TIER_FOLDER[badge.secret_tier];
  const volume = TIER_VOLUME[badge.secret_tier];
  const useOverride = overrideExists.get(cacheKey(folder, badge.code)) === true;
  const src = useOverride ? `/sounds/badges/${folder}/${badge.code}.mp3` : `/sounds/badges/${folder}/default.mp3`;
  const audio = new Audio(src);
  audio.volume = volume;
  audio.play().catch(() => {});
}
