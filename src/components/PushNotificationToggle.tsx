"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * 브라우저 푸시 알림 구독 온/오프 토글. 구독 상태는 DB 컬럼이 아니라 "이 기기(브라우저)가
 * 실제로 구독 중인가"를 pushManager에 직접 물어봐서 판단한다 — 같은 계정이라도 기기마다
 * 구독 여부가 다를 수 있어서(폰/노트북 따로), 다른 체크박스(이메일 알림 등)처럼 profiles
 * 컬럼 하나로 표현할 수 없다.
 *
 * iOS 사파리는 홈 화면에 추가해서 그 아이콘으로 실행 중일 때만(그리고 16.4 이상)
 * Notification API 자체가 존재한다 — 지원 안 하는 환경에서는 안내 문구만 보여준다.
 */
export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const iosDetected = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    setIsIos(iosDetected);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  const subscribe = async () => {
    setError(null);
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("알림 권한이 거부되었습니다. 기기 설정에서 이 사이트의 알림을 허용해주세요.");
        setLoading(false);
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setError("서버에 푸시 설정이 아직 안 되어 있습니다.");
        setLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "구독 등록에 실패했습니다.");
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "구독 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setError(null);
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "해지 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  if (!supported) {
    if (isIos && !isStandalone) {
      return (
        <p className="text-xs text-muted mt-2">
          📲 아이폰에서 푸시 알림을 받으려면 먼저 공유 버튼 → &quot;홈 화면에 추가&quot;로 앱을 설치한 뒤, 그 아이콘으로 실행해서 다시 켜주세요.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="mt-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={subscribed}
          disabled={loading}
          onChange={(e) => (e.target.checked ? subscribe() : unsubscribe())}
        />
        이 기기에서 브라우저 알림 받기
      </label>
      {error && <p className="text-red text-xs mt-1">{error}</p>}
    </div>
  );
}
