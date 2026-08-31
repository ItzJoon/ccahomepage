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

/**
 * 뱃지 획득 효과음을 재생한다. 등급 폴더 안에 뱃지 code와 같은 이름의 파일이 있으면
 * 그걸 우선 재생하고, 없으면(로드 에러) 그 등급 폴더의 default.mp3로 자동 대체한다 —
 * 관리자가 뱃지별 전용 사운드를 넣을지 등급 공통 사운드만 쓸지 자유롭게 고를 수 있다.
 */
export function playBadgeSound(badge: Pick<BadgeDef, "code" | "secret_tier">) {
  const folder = TIER_FOLDER[badge.secret_tier];
  const volume = TIER_VOLUME[badge.secret_tier];
  let fellBack = false;

  const playDefault = () => {
    if (fellBack) return;
    fellBack = true;
    const fallback = new Audio(`/sounds/badges/${folder}/default.mp3`);
    fallback.volume = volume;
    fallback.play().catch(() => {});
  };

  const specific = new Audio(`/sounds/badges/${folder}/${badge.code}.mp3`);
  specific.volume = volume;
  specific.addEventListener("error", playDefault, { once: true });
  specific.play().catch(playDefault);
}
