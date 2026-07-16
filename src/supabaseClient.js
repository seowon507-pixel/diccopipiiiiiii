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

// 새 게시글 등록. postType: 'local'(내 위치 500m 이내) | 'external'(500m 밖에서 쓴 외부작성)
// 소유권 확인용 ownerSecret을 서버의 post_owners 테이블에 같이 기록한다(삭제 권한 확인용).
export async function createPost({ lat, lng, category, title, content, postType, imageUrl, icon, ownerSecret }) {
  const { data, error } = await supabase.rpc('create_post_with_owner', {
    p_lat: lat,
    p_lng: lng,
    p_category: category,
    p_title: title,
    p_content: content,
    p_post_type: postType,
    p_image_url: imageUrl ?? null,
    p_owner_secret: ownerSecret,
  })

  if (error) throw error
  if (icon) return updatePostIcon(data.id, icon)
  return data
}

// create_post_with_owner RPC는 icon 인자를 받지 않으므로, 등록 직후 별도 UPDATE로 반영한다.
async function updatePostIcon(id, icon) {
  const { data, error } = await supabase
    .from('posts')
    .update({ icon })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// 지도 위 "빈 핀"(아직 글이 없는 위치 마커) 목록 조회
export async function getPins() {
  const { data, error } = await supabase.from('pins').select('*')
  if (error) throw error
  return data
}

// 빈 핀 생성. 소유권 확인용 ownerSecret을 pin_owners 테이블에 같이 기록한다(삭제 권한 확인용).
export async function createPin({ lat, lng, ownerSecret }) {
  const { data, error } = await supabase.rpc('create_pin_with_owner', {
    p_lat: lat,
    p_lng: lng,
    p_owner_secret: ownerSecret,
  })

  if (error) throw error
  return data
}

// 핀 삭제. ownerSecret이 서버에 기록된 값과 일치할 때만 실제로 삭제된다.
export async function deletePin(id, ownerSecret) {
  const { data, error } = await supabase.rpc('delete_own_pin', {
    p_pin_id: id,
    p_secret: ownerSecret,
  })

  if (error) throw error
  return data // true/false
}

// pins 테이블의 등록(INSERT)/삭제(DELETE)를 실시간으로 구독한다. 구독 해제 함수를 반환한다.
export function subscribeToPinChanges({ onInsert, onDelete }) {
  const channel = supabase
    .channel('pins-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pins' },
      (payload) => onInsert?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'pins' },
      (payload) => onDelete?.(payload.old),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// 게시글 삭제. ownerSecret이 서버에 기록된 값과 일치할 때만 실제로 삭제된다.
export async function deletePost(id, ownerSecret) {
  const { data, error } = await supabase.rpc('delete_own_post', {
    p_post_id: id,
    p_secret: ownerSecret,
  })

  if (error) throw error
  return data // true/false
}

// 게시글 이미지를 Storage에 업로드하고 공개 URL을 반환한다.
export async function uploadPostImage(file) {
  const ext = file.name.split('.').pop()
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('post-images').upload(path, file)
  if (error) throw error

  const { data } = supabase.storage.from('post-images').getPublicUrl(path)
  return data.publicUrl
}

// 기존 게시글 내용 수정 (수정 시각을 updated_at에 기록)
export async function updatePost(id, { category, title, content, imageUrl, icon }) {
  const { data, error } = await supabase
    .from('posts')
    .update({
      category,
      title,
      content,
      image_url: imageUrl ?? null,
      icon: icon ?? null,
      updated_at: new Date().toISOString(),
    })
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

// posts 테이블의 등록(INSERT)/수정(UPDATE)/삭제(DELETE)를 실시간으로 구독한다. 구독 해제 함수를 반환한다.
export function subscribeToPostChanges({ onInsert, onUpdate, onDelete }) {
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
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'posts' },
      (payload) => onDelete?.(payload.old),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
