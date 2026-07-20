// 우리동네알림 서비스워커 — 26번 단계부터 두 가지 역할을 함께 한다:
// 1) 관심 지역/키워드 웹 푸시 처리(push/notificationclick, 14번 이후 그대로)
// 2) vite-plugin-pwa(injectManifest 전략)가 빌드 시 넣어주는 앱 셸(빌드된 JS/CSS/HTML)
//    프리캐싱 — 오프라인에서도 앱이 최소한 뜨게 한다.
// 지도(카카오맵 외부 스크립트)와 Supabase 실시간 데이터는 애초에 네트워크가 있어야만
// 의미가 있어서 캐싱 대상이 아니다 — "오프라인에서 글도 보고 지도도 본다"가 아니라
// "오프라인이어도 앱 진입 화면은 흰 화면 대신 뜬다" 정도가 이 앱 구조상 현실적인 목표다.
import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// registerType: 'autoUpdate'(vite.config.js)와 짝을 이룬다 — 새 배포가 있으면 열려있는
// 탭을 새로고침하지 않아도 다음 네비게이션부터 바로 새 버전이 적용되게 한다.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

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
      icon: '/icons/icon-192.png',
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
