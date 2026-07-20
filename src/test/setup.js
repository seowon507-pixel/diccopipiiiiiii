import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Node 22+가 --localstorage-file 없이는 항상 undefined인 전역 localStorage/sessionStorage
// getter를 정의해두면, jsdom이 제공하는 실제 동작 구현을 밀어내 버려 모든 테스트의
// localStorage.clear() 호출이 깨진다(jsdom/vitest/Node 조합 이슈). 테스트에는 디스크 백엔드가
// 필요 없으니 순수 메모리 Storage로 두 전역을 직접 덮어써서 항상 동작하게 한다.
function createMemoryStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)) },
    removeItem: (key) => { store.delete(String(key)) },
    clear: () => { store.clear() },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size },
  }
}

for (const key of ['localStorage', 'sessionStorage']) {
  const storage = createMemoryStorage()
  Object.defineProperty(globalThis, key, { value: storage, configurable: true, writable: true })
  Object.defineProperty(window, key, { value: storage, configurable: true, writable: true })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
