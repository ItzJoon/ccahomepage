"use client";

import { useRealtimeList } from "@/hooks/useRealtimeList";
import HiddenClickWatcher from "./HiddenClickWatcher";
import FlashButtonWatcher from "./FlashButtonWatcher";
import SecretPageLinkWatcher from "./SecretPageLinkWatcher";
import DailySecretRollWatcher from "./DailySecretRollWatcher";
import type { BadgeDef } from "@/lib/types";

/**
 * "시크릿 뱃지 트리거" 4종(숨은 클릭/순간 버튼/시간대 페이지/일일 확률)이 공유하는
 * badges 구독을 한 번만 열어서 트리거 타입별로 나눠준다 — 각 하위 watcher가 각자
 * useRealtimeList("badges")를 부르면 같은 데이터를 4번 중복 구독하게 되므로 여기서
 * 한 번만 구독한다. (site)/layout.tsx에 BadgeGrantWatcher 등 기존 watcher와 나란히
 * 마운트한다 — 실제 지급(user_badges insert)은 서버 RPC가 하고, 그 결과 축하 팝업은
 * 이미 마운트돼 있는 BadgeGrantWatcher가 자동으로 집어서 보여주므로 여기서는 신경쓰지 않는다.
 */
export default function SecretBadgeWatchers({ userId }: { userId: string | null }) {
  const { rows } = useRealtimeList<BadgeDef>("badges", {
    filter: (q) => q.eq("award_type", "secret_trigger").eq("is_active", true),
  });

  if (!userId) return null;

  const byType = (type: BadgeDef["trigger_type"]) => rows.filter((b) => b.trigger_type === type);

  return (
    <>
      <HiddenClickWatcher badges={byType("hidden_click")} />
      <FlashButtonWatcher badges={byType("flash_button")} />
      <SecretPageLinkWatcher badges={byType("timed_page")} />
      <DailySecretRollWatcher badges={byType("daily_chance")} />
    </>
  );
}
