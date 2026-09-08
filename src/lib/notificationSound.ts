/**
 * 알림/패치노트에 첨부된 mp3를 재생한다. 브라우저 자동재생 정책상 사용자가 아직
 * 페이지와 상호작용하지 않았으면 play()가 거부될 수 있는데, 이 경우 알림 자체는
 * 정상적으로 떠야 하므로 에러를 조용히 무시한다(뱃지 효과음 재생 방식과 동일).
 */
export function playAttachedSound(url: string | null | undefined, volume = 0.5) {
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(() => {});
}
