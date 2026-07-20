import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('./supabaseClient', () => ({
  supabase: { rpc: rpcMock },
  backendConfigurationError: null,
}))

import {
  canModerate,
  fetchCurrentAppRole,
  fetchModerationQueue,
  resolveModerationCase,
} from './moderation'

describe('moderation API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('관리자와 운영자 역할만 관리자 화면을 열 수 있다', () => {
    expect(canModerate('user')).toBe(false)
    expect(canModerate('moderator')).toBe(true)
    expect(canModerate('admin')).toBe(true)
  })

  it('현재 역할과 안전한 신고 큐 RPC를 사용한다', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: 'admin', error: null })
      .mockResolvedValueOnce({ data: [{ case_id: 1 }], error: null })

    await expect(fetchCurrentAppRole()).resolves.toBe('admin')
    await expect(fetchModerationQueue({ status: 'pending' })).resolves.toEqual([{ case_id: 1 }])
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'current_app_role_v1')
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'list_moderation_queue_v1', {
      p_status: 'pending',
      p_limit: 50,
      p_offset: 0,
    })
  })

  it('관리 조치는 case id와 허용된 action, 메모만 전송한다', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 7, status: 'actioned' }], error: null })

    await expect(resolveModerationCase(7, 'hide', '  반복 신고  ')).resolves.toEqual({
      id: 7,
      status: 'actioned',
    })
    expect(rpcMock).toHaveBeenCalledWith('resolve_moderation_case_v1', {
      p_case_id: 7,
      p_action: 'hide',
      p_note: '반복 신고',
    })
  })
})
