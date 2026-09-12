// 웹 푸시 알림 전용 최소 서비스워커. 오프라인 캐싱 등은 하지 않는다(요청받은 기능은
// 푸시뿐이라 범위를 넓히지 않음) — fetch 이벤트를 가로채지 않으므로 네트워크 동작은
// 서비스워커가 없을 때와 완전히 동일하다.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "학생자치회", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "학생자치회";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림을 누르면 이미 열려 있는 탭이 있으면 그 탭으로 포커스만 옮기고, 없으면 새로 연다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
