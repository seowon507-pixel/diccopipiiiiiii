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
    localStorage.clear()
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

  it('게시글 생성은 복구 코드를 포함한 v3 RPC를 사용한다', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: 'post-1' }], error: null })
    const { createPost } = await loadClient()

    await createPost({
      id: 'post-1',
      actorToken: 'a'.repeat(32),
      ownerSecret: 'o'.repeat(32),
      deviceSecret: 'd'.repeat(32),
      authorLat: 37.5,
      authorLng: 127,
      lat: 37.5,
      lng: 127,
      category: '일상',
      title: '제목',
      content: '내용입니다',
    })

    expect(rpcMock).toHaveBeenCalledWith('create_post_v3', expect.objectContaining({
      p_post_id: 'post-1',
      p_owner_secret: 'o'.repeat(32),
      p_device_secret: 'd'.repeat(32),
    }))
  })

  it('답글도 직접 INSERT 없이 create_comment_v3 RPC로 등록한다', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: 'comment-2' }], error: null })
    const { createComment } = await loadClient()

    await createComment('post-1', '답글 내용', {
      id: 'comment-2',
      actorToken: 'a'.repeat(32),
      parentCommentId: 'comment-1',
    })

    expect(rpcMock).toHaveBeenCalledWith('create_comment_v3', {
      p_comment_id: 'comment-2',
      p_post_id: 'post-1',
      p_actor_token: 'a'.repeat(32),
      p_content: '답글 내용',
      p_parent_comment_id: 'comment-1',
    })
  })

  it('복구·신고·반응은 plaintext legacy 이름보다 버전형 RPC를 우선한다', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [{ target_type: 'post', target_id: 'post-1', owner_secret: 'owner' }], error: null })
      .mockResolvedValueOnce({ data: { report_count: 1, hidden: false }, error: null })
      .mockResolvedValueOnce({ data: { count: 1, reacted: true }, error: null })
    const { restoreOwnership, reportPost, reactToComment } = await loadClient()

    await restoreOwnership('d'.repeat(32))
    await reportPost('post-1', 'r'.repeat(32))
    await reactToComment('comment-1', '👍', 'd'.repeat(32))

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'restore_ownership_v2', {
      p_device_secret: 'd'.repeat(32),
      p_actor_token: expect.any(String),
    })
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'report_post_v3', { p_post_id: 'post-1' })
    expect(rpcMock).toHaveBeenNthCalledWith(3, 'react_to_comment_v2', {
      p_comment_id: 'comment-1',
      p_emoji: '👍',
      p_reactor_secret: 'd'.repeat(32),
    })
  })

  it('관리자 마이그레이션 전 개발 DB에서는 신고 v3가 없을 때만 v2로 전환한다', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing function' } })
      .mockResolvedValueOnce({ data: { report_count: 1, hidden: false }, error: null })
    const { reportPost } = await loadClient()

    await reportPost('post-1', 'r'.repeat(32))

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'report_post_v3', { p_post_id: 'post-1' })
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'report_post_v2', {
      p_post_id: 'post-1',
      p_reporter_secret: 'r'.repeat(32),
    })
  })

  it('푸시 구독 저장과 삭제는 hash 기반 v2 RPC를 사용한다', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const { upsertPushSubscription, deletePushSubscription } = await loadClient()

    await upsertPushSubscription({
      deviceSecret: 'd'.repeat(32),
      endpoint: 'https://push.example/subscription',
      p256dh: 'p'.repeat(32),
      auth: 'a'.repeat(16),
      interestAreas: [],
      keywords: [],
      quietStart: null,
      quietEnd: null,
    })
    await deletePushSubscription('d'.repeat(32))

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'upsert_push_subscription_v2', expect.objectContaining({
      p_device_secret: 'd'.repeat(32),
      p_endpoint: 'https://push.example/subscription',
    }))
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'delete_push_subscription_v2', {
      p_device_secret: 'd'.repeat(32),
    })
  })
})
