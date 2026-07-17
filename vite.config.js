import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA는 8번 단계에서 한 번 뺐던 적이 있다(직접 파일 업로드 배포에서 아이콘 바이너리가
// 깨지는 문제) — 지금은 git 저장소(및 Vercel git 연동)로 정상 배포하고, 아이콘도 실제
// PNG 바이너리로 커밋해뒀으니 다시 붙인다. injectManifest 전략을 쓰는 이유: 이미
// src/sw.js에 웹 푸시(push/notificationclick) 커스텀 로직이 있어서, 그걸 그대로 두고
// 오프라인 프리캐싱만 얹어야 하기 때문(generateSW는 서비스워커 전체를 자동 생성해버려서
// 커스텀 push 핸들러를 못 끼워 넣는다).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        // 앱 셸(빌드된 JS/CSS/HTML)만 프리캐시한다 — 기본값 그대로.
        globPatterns: ['**/*.{js,css,html}'],
      },
      manifest: {
        name: '우리동네알림',
        short_name: '우리동네알림',
        description: '지도 기반 동네 커뮤니티 — 실시간 알림과 자유주제 글을 지도 위에서 나눠요.',
        lang: 'ko',
        theme_color: '#2e7d6b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      // 개발 서버(npm run dev)에서는 서비스워커를 안 띄운다 — devOptions.enabled: true로
      // 시도해봤지만 실제 브라우저 등록 시 /sw.js 응답이 Vite dev의 SPA 폴백(HTML)과 섞여
      // MIME 타입 문제가 날 수 있는 걸 확인했다(injectManifest + dev 조합이 원래 까다로운
      // 부분 — vite-plugin-pwa도 공식적으로 "오프라인 캐싱은 build+preview로 검증하라"고
      // 안내한다). 그래서 원래 sw.js가 public/에 있어 dev에서도 되던 것과 달리, PWA/오프라인/
      // 푸시 테스트는 이제 npm run build && npm run preview(또는 실제 배포)로 해야 한다 —
      // CLAUDE.md에도 남겨둘 것.
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
