import { createClient } from '@supabase/supabase-js'
import dummyData from '../dummy-data.json'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// posts 목록 조회. Supabase 연결/조회 실패 시 dummy-data.json으로 대체한다.
export async function getPosts() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  } catch (err) {
    console.warn('[supabaseClient] posts 조회 실패, dummy-data.json으로 대체합니다.', err)
    return dummyData.posts
  }
}

// 새 게시글 등록. postType: 'local'(내 위치 500m 이내) | 'inquiry'(500m 밖에서 쓴 문의글)
export async function createPost({ lat, lng, category, title, content, postType }) {
  const { data, error } = await supabase
    .from('posts')
    .insert({ lat, lng, category, title, content, post_type: postType })
    .select()
    .single()

  if (error) throw error
  return data
}

// 기존 게시글 내용 수정 (수정 시각을 updated_at에 기록)
export async function updatePost(id, { category, title, content }) {
  const { data, error } = await supabase
    .from('posts')
    .update({ category, title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 신뢰도 확인(confirm_count) 1 증가 — 실시간 알림 카테고리 전용
export async function incrementConfirmCount(id, currentCount) {
  const { data, error } = await supabase
    .from('posts')
    .update({ confirm_count: currentCount + 1 })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 추천(좋아요) 1 증가 — 자유주제 카테고리 전용
export async function incrementLikes(id, currentCount) {
  const { data, error } = await supabase
    .from('posts')
    .update({ likes_count: currentCount + 1 })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 특정 게시글의 댓글 목록 조회
export async function getComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// 댓글 등록
export async function createComment(postId, content) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, content })
    .select()
    .single()

  if (error) throw error
  return data
}

// 특정 게시글의 새 댓글을 실시간으로 구독한다. 구독 해제 함수를 반환한다.
export function subscribeToComments(postId, onInsert) {
  const channel = supabase
    .channel(`comments-${postId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
      (payload) => onInsert(payload.new),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// posts 테이블의 등록(INSERT)/수정(UPDATE)을 실시간으로 구독한다. 구독 해제 함수를 반환한다.
export function subscribeToPostChanges({ onInsert, onUpdate }) {
  const channel = supabase
    .channel('posts-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'posts' },
      (payload) => onInsert?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'posts' },
      (payload) => onUpdate?.(payload.new),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
