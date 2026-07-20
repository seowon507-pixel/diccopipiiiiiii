import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, fromMock, rpcMock, unsubscribeMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
  },
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}))

vi.mock('./supabaseClient', () => ({
  supabase: { auth: authMock, from: fromMock, rpc: rpcMock },
  backendConfigurationError: null,
}))

import { signUpWithPassword, subscribeToAuthState } from './auth'

describe('auth session bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    })
  })

  it('세션 조회가 실패해도 로그인 화면으로 복구하고 오류를 전달한다', async () => {
    const failure = new Error('network down')
    const onChange = vi.fn()
    const onError = vi.fn()
    authMock.getSession.mockRejectedValue(failure)

    const unsubscribe = subscribeToAuthState(onChange, onError)
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure))

    expect(onChange).toHaveBeenCalledWith(null)
    unsubscribe()
    expect(unsubscribeMock).toHaveBeenCalledOnce()
  })

  it('인증 이벤트가 먼저 오면 오래된 getSession 결과로 덮어쓰지 않는다', async () => {
    let resolveSession
    authMock.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve }))
    let authListener
    authMock.onAuthStateChange.mockImplementation((listener) => {
      authListener = listener
      return { data: { subscription: { unsubscribe: unsubscribeMock } } }
    })
    const onChange = vi.fn()

    subscribeToAuthState(onChange)
    const liveSession = { user: { id: 'new-user' } }
    authListener('SIGNED_IN', liveSession)
    resolveSession({ data: { session: null }, error: null })
    await Promise.resolve()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(liveSession)
  })

  it('회원가입 인증 메일이 현재 앱 주소로 돌아오도록 redirect URL을 보낸다', async () => {
    authMock.signUp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    await signUpWithPassword('member@example.com', 'password')

    expect(authMock.signUp).toHaveBeenCalledWith({
      email: 'member@example.com',
      password: 'password',
      options: { emailRedirectTo: window.location.origin },
    })
  })
})
