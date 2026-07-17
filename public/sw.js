// 우리동네알림 — 관심 지역/키워드 웹 푸시 전용 최소 서비스워커.
// vite-plugin-pwa(오프라인 캐싱/설치형 앱) 전체 세트는 일부러 안 붙였다 — 8번 단계에서
// 배포 이슈로 제거된 이력이 있어서, 이번엔 알림에 필요한 push/notificationclick만 처리한다.

self.addEventListener('push', (event) => {
  let payload = { title: '우리동네알림', body: '새 소식이 있어요.', url: '/' }
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: undefined,
      data: { url: payload.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(targetUrl)
    }),
  )
})
