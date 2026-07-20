import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATEGORIES, getElapsedRatio } from './categories'
import { getDistanceMeters } from './geo'
import {
  DUMMY_CENTER,
  confirmDummyPost,
  createDummyComment,
  createDummyPost,
  getDummyComments,
  getDummyNearbyChatMessages,
  getDummyPosts,
  likeDummyPost,
  reactToDummyComment,
  reportDummyPost,
  resetDummyData,
  subscribeToDummyPosts,
} from './dummyStore'

const REFERENCE_TIME = Date.parse('2026-07-20T03:00:00.000Z')
const CAMPUS_WAITING_POST_ID = '10000000-0000-4000-8000-000000000001'
const CAMPUS_QUESTION_POST_ID = '10000000-0000-4000-8000-000000000005'

describe('full-feature dummy data', () => {
  beforeEach(() => {
    vi.useRealTimers()
    resetDummyData(REFERENCE_TIME)
  })

  it('성심교정 주변과 전국에 모든 카테고리의 상대 시각 샘플을 제공한다', () => {
    const posts = getDummyPosts()
    const nearby = posts.filter((post) => (
      getDistanceMeters(DUMMY_CENTER.lat, DUMMY_CENTER.lng, post.lat, post.lng) <= 500
    ))

    expect(posts).toHaveLength(20)
    expect(nearby).toHaveLength(12)
    expect(new Set(posts.map((post) => post.category))).toEqual(new Set(CATEGORIES))
    expect(posts.filter((post) => post.image_url)).toHaveLength(7)

    const waiting = posts.find((post) => post.id === CAMPUS_WAITING_POST_ID)
    expect(getElapsedRatio(waiting, REFERENCE_TIME)).toBeLessThan(1)
    expect(waiting.is_dummy).toBe(true)
  })

  it('확인과 추천을 사용자별 한 번만 반영한다', () => {
    const confirmed = confirmDummyPost(CAMPUS_WAITING_POST_ID, 'actor-a')
    const duplicated = confirmDummyPost(CAMPUS_WAITING_POST_ID, 'actor-a')
    const confirmedByAnother = confirmDummyPost(CAMPUS_WAITING_POST_ID, 'actor-b')

    expect(confirmed.confirm_count).toBe(12)
    expect(duplicated.confirm_count).toBe(12)
    expect(confirmedByAnother.confirm_count).toBe(13)

    expect(likeDummyPost(CAMPUS_QUESTION_POST_ID, 'actor-a').likes_count).toBe(5)
    expect(likeDummyPost(CAMPUS_QUESTION_POST_ID, 'actor-a').likes_count).toBe(5)
  })

  it('댓글·답글·이모지 토글과 신고 숨김을 메모리에서 재현한다', () => {
    const topLevel = createDummyComment({
      id: '60000000-0000-4000-8000-000000000001',
      postId: CAMPUS_QUESTION_POST_ID,
      content: '새 샘플 댓글',
    })
    createDummyComment({
      id: '60000000-0000-4000-8000-000000000002',
      postId: CAMPUS_QUESTION_POST_ID,
      content: '새 샘플 답글',
      parentCommentId: topLevel.id,
    })

    expect(getDummyComments(CAMPUS_QUESTION_POST_ID).slice(-2).map((comment) => comment.content))
      .toEqual(['새 샘플 댓글', '새 샘플 답글'])
    expect(reactToDummyComment(topLevel.id, '👍', 'device-a')).toEqual({ count: 1, reacted: true })
    expect(reactToDummyComment(topLevel.id, '👍', 'device-a')).toEqual({ count: 0, reacted: false })

    for (let index = 0; index < 5; index += 1) {
      reportDummyPost(CAMPUS_QUESTION_POST_ID, `reporter-${index}`)
    }
    expect(getDummyPosts().some((post) => post.id === CAMPUS_QUESTION_POST_ID)).toBe(false)
  })

  it('채팅 반경 필터가 성심교정 대화와 전국 대화를 섞지 않는다', () => {
    const campusMessages = getDummyNearbyChatMessages({
      lat: DUMMY_CENTER.lat,
      lng: DUMMY_CENTER.lng,
      radiusMeters: 1000,
    })
    const busanMessages = getDummyNearbyChatMessages({ lat: 35.1587, lng: 129.1604, radiusMeters: 1000 })

    expect(campusMessages).toHaveLength(8)
    expect(campusMessages.every((message) => message.content.includes('샘플 대화'))).toBe(true)
    expect(busanMessages).toHaveLength(1)
  })

  it('게시글 메모리 변경을 Realtime 모양의 구독 이벤트로 전달한다', async () => {
    const onInsert = vi.fn()
    const onStatus = vi.fn()
    const unsubscribe = subscribeToDummyPosts({ onInsert, onStatus })

    await Promise.resolve()
    const created = createDummyPost({
      id: '60000000-0000-4000-8000-000000000003',
      actorToken: 'actor-a',
      authorLat: DUMMY_CENTER.lat,
      authorLng: DUMMY_CENTER.lng,
      lat: DUMMY_CENTER.lat,
      lng: DUMMY_CENTER.lng,
      category: '일상',
      title: '테스트 작성',
      content: '메모리 더미 글',
      imageUrl: null,
      icon: 'home',
    })

    expect(onStatus).toHaveBeenCalledWith('SUBSCRIBED', null)
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: created.id, is_dummy: true }))
    unsubscribe()
  })
})
