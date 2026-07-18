import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, rpcMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

async function loadClient() {
  return import('./supabaseClient')
}

describe('Supabase legacy compatibility', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.stubEnv('VITE_ALLOW_LEGACY_BACKEND', 'true')
    createClientMock.mockReset()
    rpcMock.mockReset()
    createClientMock.mockReturnValue({ rpc: rpcMock })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('v2 RPC가 성공하면 legacy RPC를 호출하지 않는다', async () => {
    const result = { id: 'post-1', deleted: true }
    rpcMock.mockResolvedValueOnce({ data: [result], error: null })
    const { deletePost } = await loadClient()

    await expect(deletePost('post-1', 'owner-secret')).resolves.toEqual(result)
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('delete_own_post_v2', {
      p_post_id: 'post-1',
      p_owner_secret: 'owner-secret',
    })
  })

  it(
    'v2 RPC가 없을 때만 legacy RPC로 전환한다',
    async () => {
      const legacyResult = true
      rpcMock
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing function' } })
        .mockResolvedValueOnce({ data: legacyResult, error: null })
      const { deletePost } = await loadClient()

      await expect(deletePost('post-1', 'owner-secret')).resolves.toBe(legacyResult)
      expect(rpcMock).toHaveBeenNthCalledWith(1, 'delete_own_post_v2', {
        p_post_id: 'post-1',
        p_owner_secret: 'owner-secret',
      })
      expect(rpcMock).toHaveBeenNthCalledWith(2, 'delete_own_post', {
        p_post_id: 'post-1',
        p_secret: 'owner-secret',
      })
    },
  )

  it.each([
    { code: '42883', message: 'internal dependency does not exist' },
    { code: '42501', message: 'not owner' },
    { code: '22023', message: 'invalid input' },
    { code: '42501', message: 'Could not find the function, but access is denied' },
    { code: 'P0001', message: 'Could not find the function', hint: 'RATE_LIMIT' },
    { code: '', message: 'TypeError: Failed to fetch' },
    { code: '', message: 'Could not find the function because the network failed' },
  ])('권한·검증·네트워크 오류에서는 보안 경계를 낮추지 않는다 ($code)', async (error) => {
    rpcMock.mockResolvedValueOnce({ data: null, error })
    const { deletePost } = await loadClient()

    await expect(deletePost('post-1', 'owner-secret')).rejects.toBe(error)
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  it('legacy RPC도 실패하면 해당 오류를 그대로 전달하고 재시도하지 않는다', async () => {
    const legacyError = { code: '42501', message: 'legacy denied' }
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing function' } })
      .mockResolvedValueOnce({ data: null, error: legacyError })
    const { deletePost } = await loadClient()

    await expect(deletePost('post-1', 'owner-secret')).rejects.toBe(legacyError)
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })

  it('호환 모드가 꺼져 있으면 PGRST202도 legacy로 전환하지 않는다', async () => {
    const missingError = { code: 'PGRST202', message: 'missing function' }
    vi.stubEnv('VITE_ALLOW_LEGACY_BACKEND', 'false')
    vi.resetModules()
    rpcMock.mockResolvedValueOnce({ data: null, error: missingError })
    const { deletePost } = await loadClient()

    await expect(deletePost('post-1', 'owner-secret')).rejects.toBe(missingError)
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })
})
