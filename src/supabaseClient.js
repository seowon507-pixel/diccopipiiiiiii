import { createClient } from '@supabase/supabase-js'
import dummyData from '../dummy-data.json'
import { getDistanceMeters } from './geo'
import { generateOwnerSecret, getOrCreateActorToken } from './myPosts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const useDummyData = import.meta.env.DEV && import.meta.env.VITE_USE_DUMMY_DATA === 'true'
// 운영 환경은 반드시 보안 migration을 사용한다. 아직 migration을 적용하지 않은 기존 개발 DB는
// 명시적으로 이 플래그를 켠 경우에만 legacy 계약으로 제한적으로 되돌아간다.
const allowLegacyBackend = import.meta.env.DEV && import.meta.env.VITE_ALLOW_LEGACY_BACKEND === 'true'

const POST_IMAGE_BUCKET = 'post-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const LEGACY_EXTERNAL_DISTANCE_METERS = 500
const LEGACY_PIN_RETENTION_MINUTES = 60
const warnedLegacyOperations = new Set()
const legacyOnlyOperations = new Set()

export class BackendConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BackendConfigurationError'
    this.code = 'BACKEND_CONFIG'
  }
}

function isValidSupabaseUrl(value) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch {
    return false
  }
}

export const backendConfigurationError = isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey
  ? null
  : new BackendConfigurationError('Supabase URL 또는 anon key가 설정되지 않았거나 올바르지 않습니다.')

// A missing environment must not crash module evaluation. Callers receive a typed error instead.
const DEV_CLIENT_CACHE_KEY = '__woorimadongSupabaseClient'

function getOrCreateSupabaseClient() {
  // Vite HMR이 이 모듈을 다시 평가할 때 GoTrueClient가 중복 생성되면 동일한 storage key를
  // 여러 인스턴스가 경합한다. 개발 브라우저에서만 URL/key가 같은 client를 재사용한다.
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    const cached = globalThis[DEV_CLIENT_CACHE_KEY]
    if (cached?.url === supabaseUrl && cached?.anonKey === supabaseAnonKey) return cached.client

    const client = createClient(supabaseUrl, supabaseAnonKey)
    globalThis[DEV_CLIENT_CACHE_KEY] = { url: supabaseUrl, anonKey: supabaseAnonKey, client }
    return client
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = backendConfigurationError ? null : getOrCreateSupabaseClient()

function requireSupabase() {
  if (!supabase) throw backendConfigurationError
  return supabase
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return generateOwnerSecret()
}

function actorTokenOrDefault(actorToken) {
  return typeof actorToken === 'string' && actorToken.length >= 32
    ? actorToken
    : getOrCreateActorToken()
}

function unwrapRpcRow(data) {
  return Array.isArray(data) ? (data[0] ?? null) : data
}

export function isMissingRpcError(error) {
  const code = String(error?.code ?? '')
  // PGRST202 is PostgREST's top-level "RPC route/signature not found" signal.
  // PostgreSQL 42883 can also be raised inside an existing function, so falling back on it
  // could hide a broken v2 migration and silently lower the security boundary.
  return code === 'PGRST202'
}

function warnLegacyFallback(operation) {
  if (warnedLegacyOperations.has(operation)) return
  warnedLegacyOperations.add(operation)
  console.warn(`[supabaseClient] ${operation}: v2 RPC가 없어 개발용 legacy 호환 경로를 사용합니다.`)
}

async function withLegacyFallback(operation, modernRequest, legacyRequest) {
  if (allowLegacyBackend && legacyOnlyOperations.has(operation)) return legacyRequest()

  try {
    return await modernRequest()
  } catch (error) {
    if (!allowLegacyBackend || !isMissingRpcError(error)) throw error
    legacyOnlyOperations.add(operation)
    warnLegacyFallback(operation)
    return legacyRequest()
  }
}

async function rpc(name, params) {
  const { data, error } = await requireSupabase().rpc(name, params)
  if (error) throw error
  return unwrapRpcRow(data)
}

async function rpcRows(name, params) {
  const { data, error } = await requireSupabase().rpc(name, params)
  if (error) throw error
  return data ?? []
}

function unavailableSubscription(onStatus) {
  queueMicrotask(() => onStatus?.('CONFIG_ERROR', backendConfigurationError))
  return () => {}
}

function activateChannel(channel, onStatus) {
  channel.subscribe((status, error) => onStatus?.(status, error ?? null))
  return () => {
    supabase?.removeChannel(channel)
  }
}

export async function getPosts() {
  if (useDummyData) return dummyData.posts

  const { data, error } = await requireSupabase()
    .from('posts')
    .select('*')
    .eq('hidden', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// The id is generated before the request so retrying the same payload is idempotent.
export async function createPost({
  id = randomId(),
  actorToken,
  ownerSecret,
  authorLat,
  authorLng,
  lat,
  lng,
  category,
  title,
  content,
  imageUrl,
  icon,
  postType,
  deviceSecret,
}) {
  if (!ownerSecret) throw new TypeError('ownerSecret is required')

  return withLegacyFallback(
    'createPost',
    () => rpc('create_post_v3', {
      p_post_id: id,
      p_actor_token: actorTokenOrDefault(actorToken),
      p_owner_secret: ownerSecret,
      p_author_lat: authorLat ?? lat,
      p_author_lng: authorLng ?? lng,
      p_lat: lat,
      p_lng: lng,
      p_category: category,
      p_title: title,
      p_content: content,
      p_image_url: imageUrl ?? null,
      p_icon: icon ?? null,
      p_device_secret: deviceSecret ?? null,
    }),
    async () => {
      const resolvedPostType = postType ?? (
        Number.isFinite(authorLat) && Number.isFinite(authorLng)
          && getDistanceMeters(authorLat, authorLng, lat, lng) > LEGACY_EXTERNAL_DISTANCE_METERS
          ? 'external'
          : 'local'
      )
      const created = await rpc('create_post_with_owner', {
        p_lat: lat,
        p_lng: lng,
        p_category: category,
        p_title: title,
        p_content: content,
        p_post_type: resolvedPostType,
        p_image_url: imageUrl ?? null,
        p_owner_secret: ownerSecret,
        p_device_secret: deviceSecret ?? null,
      })

      if (!icon) return created
      const { data, error } = await requireSupabase()
        .from('posts')
        .update({ icon })
        .eq('id', created.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
  )
}

export async function getPins() {
  const { data, error } = await requireSupabase().from('pins').select('*')
  if (error) throw error
  return data
}

// 빈 핀 생성. deviceSecret은 익명 소유권 복구용으로 legacy RPC에 함께 전달한다.
export async function createPin({ id = randomId(), actorToken, lat, lng, ownerSecret, deviceSecret }) {
  if (!ownerSecret) throw new TypeError('ownerSecret is required')

  return withLegacyFallback(
    'createPin',
    () => rpc('create_pin_v3', {
      p_pin_id: id,
      p_actor_token: actorTokenOrDefault(actorToken),
      p_lat: lat,
      p_lng: lng,
      p_owner_secret: ownerSecret,
      p_device_secret: deviceSecret ?? null,
    }),
    () => rpc('create_pin_with_owner', {
      p_lat: lat,
      p_lng: lng,
      p_owner_secret: ownerSecret,
      p_device_secret: deviceSecret ?? null,
    }),
  )
}

// 다른 기기에서 예전 device_secret(복구 코드)을 입력했을 때 그 코드로 만든 글/핀 소유권을 되찾는다.
export async function restoreOwnership(deviceSecret) {
  return withLegacyFallback(
    'restoreOwnership',
    () => rpcRows('restore_ownership_v2', {
      p_device_secret: deviceSecret,
      p_actor_token: actorTokenOrDefault(),
    }),
    () => rpcRows('restore_ownership', { p_device_secret: deviceSecret }),
  )
}

export async function deletePin(id, ownerSecret) {
  return withLegacyFallback(
    'deletePin',
    () => rpc('delete_own_pin_v2', {
      p_pin_id: id,
      p_owner_secret: ownerSecret,
    }),
    () => rpc('delete_own_pin', {
      p_pin_id: id,
      p_secret: ownerSecret,
    }),
  )
}

// The v2 RPC owns the retention constant. A caller can no longer lower it to mass-delete fresh pins.
export async function deleteExpiredPins(olderThanMinutes = LEGACY_PIN_RETENTION_MINUTES) {
  await withLegacyFallback(
    'deleteExpiredPins',
    () => rpc('delete_expired_pins_v2', {}),
    () => rpc('delete_expired_pins', {
      p_older_than_minutes: Math.max(LEGACY_PIN_RETENTION_MINUTES, Number(olderThanMinutes) || 0),
    }),
  )
}

export function subscribeToPinChanges({ onInsert, onDelete, onStatus } = {}) {
  if (!supabase) return unavailableSubscription(onStatus)

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

  return activateChannel(channel, onStatus)
}

export async function deletePost(id, ownerSecret) {
  return withLegacyFallback(
    'deletePost',
    () => rpc('delete_own_post_v2', {
      p_post_id: id,
      p_owner_secret: ownerSecret,
    }),
    () => rpc('delete_own_post', {
      p_post_id: id,
      p_secret: ownerSecret,
    }),
  )
}

export async function uploadPostImage(file) {
  if (!file || !ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new TypeError('JPEG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.')
  }
  if (file.size > MAX_IMAGE_BYTES) throw new RangeError('이미지는 5MB 이하여야 합니다.')

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${randomId()}.${extension}`
  const client = requireSupabase()
  const { error } = await client.storage.from(POST_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  const { data } = client.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function postImagePathFromUrl(imageUrl) {
  if (!imageUrl) return null
  try {
    const url = new URL(imageUrl)
    const marker = `/storage/v1/object/public/${POST_IMAGE_BUCKET}/`
    const index = url.pathname.indexOf(marker)
    return index < 0 ? null : decodeURIComponent(url.pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

// Cleanup is queued in Postgres and completed by the service-role cleanup worker through Storage API.
export async function cleanupPostImage(imageUrl, reason = 'abandoned_upload') {
  const objectPath = postImagePathFromUrl(imageUrl)
  if (!objectPath) return false

  await rpc('enqueue_storage_cleanup_v1', {
    p_bucket_id: POST_IMAGE_BUCKET,
    p_object_path: objectPath,
    p_reason: reason,
  })
  return true
}

export const queuePostImageCleanup = cleanupPostImage
export const removePostImage = cleanupPostImage

export async function updatePost(id, ownerSecret, { category, title, content, imageUrl, icon }) {
  if (!ownerSecret) throw new TypeError('ownerSecret is required')

  return withLegacyFallback(
    'updatePost',
    () => rpc('update_own_post_v2', {
      p_post_id: id,
      p_owner_secret: ownerSecret,
      p_category: category,
      p_title: title,
      p_content: content,
      p_image_url: imageUrl ?? null,
      p_icon: icon ?? null,
    }),
    async () => {
      const { data, error } = await requireSupabase()
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
    },
  )
}

async function legacyIncrementPostField(id, field) {
  const client = requireSupabase()
  const { data: current, error: readError } = await client
    .from('posts')
    .select(field)
    .eq('id', id)
    .single()
  if (readError) throw readError

  const { data, error } = await client
    .from('posts')
    .update({ [field]: Number(current?.[field] ?? 0) + 1 })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function incrementConfirmCount(id, actorToken) {
  return withLegacyFallback(
    'incrementConfirmCount',
    () => rpc('confirm_post_v2', {
      p_post_id: id,
      p_actor_token: actorTokenOrDefault(actorToken),
    }),
    () => legacyIncrementPostField(id, 'confirm_count'),
  )
}

export async function incrementLikes(id, actorToken) {
  return withLegacyFallback(
    'incrementLikes',
    () => rpc('like_post_v2', {
      p_post_id: id,
      p_actor_token: actorTokenOrDefault(actorToken),
    }),
    () => legacyIncrementPostField(id, 'likes_count'),
  )
}

// 특정 게시글의 댓글 목록 조회. 신고 누적으로 hidden=true가 된 댓글은 제외한다.
export async function getComments(postId) {
  const { data, error } = await requireSupabase()
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .eq('hidden', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// 세 번째 인자는 최상위 댓글의 멱등 요청 옵션 또는 답글의 parent id를 모두 지원한다.
export async function createComment(postId, content, options = {}) {
  const parentCommentId = typeof options === 'string' ? options : (options.parentCommentId ?? null)
  const id = typeof options === 'object' && options.id ? options.id : randomId()
  const actorToken = typeof options === 'object' ? options.actorToken : undefined

  return withLegacyFallback(
    'createComment',
    () => rpc('create_comment_v3', {
      p_comment_id: id,
      p_post_id: postId,
      p_actor_token: actorTokenOrDefault(actorToken),
      p_content: content,
      p_parent_comment_id: parentCommentId,
    }),
    async () => {
      const { data, error } = await requireSupabase()
        .from('comments')
        .insert({ id, post_id: postId, content, parent_comment_id: parentCommentId })
        .select()
        .single()
      if (error) throw error
      return data
    },
  )
}

// 특정 게시글의 댓글 등록(INSERT)/신고로 인한 숨김(UPDATE)을 실시간으로 구독한다. 구독 해제 함수를 반환한다.
export function subscribeToComments(postId, options = {}, legacyStatus) {
  const normalized = typeof options === 'function'
    ? { onInsert: options, onStatus: legacyStatus }
    : options
  const { onInsert, onUpdate, onStatus } = normalized
  if (!supabase) return unavailableSubscription(onStatus)

  const channel = supabase
    .channel(`comments-${postId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
      (payload) => onInsert?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
      (payload) => onUpdate?.(payload.new),
    )

  return activateChannel(channel, onStatus)
}

// 게시글/댓글 신고. 같은 브라우저(reporterSecret)가 같은 대상을 여러 번 눌러도 서버에서
// 1회만 집계되고(post_reports/comment_reports의 reporter hash unique 제약), 누적 5회부터는 RPC가
// posts.hidden/comments.hidden을 자동으로 true로 바꿔 즉시 노출을 중단시킨다.
export async function reportPost(postId, reporterSecret) {
  return withLegacyFallback(
    'reportPost',
    () => rpc('report_post_v2', {
      p_post_id: postId,
      p_reporter_secret: reporterSecret,
    }),
    () => rpc('report_post', {
      p_post_id: postId,
      p_reporter_secret: reporterSecret,
    }),
  )
}

export async function reportComment(commentId, reporterSecret) {
  return withLegacyFallback(
    'reportComment',
    () => rpc('report_comment_v2', {
      p_comment_id: commentId,
      p_reporter_secret: reporterSecret,
    }),
    () => rpc('report_comment', {
      p_comment_id: commentId,
      p_reporter_secret: reporterSecret,
    }),
  )
}

// 댓글 이모지 반응 토글 — 같은 reactorSecret(notifications.js getOrCreateDeviceSecret 재사용)이
// 같은 이모지를 다시 누르면 추가↔삭제가 토글된다. comments.reactions 갱신은 realtime UPDATE로도
// 오지만(subscribeToComments), 이 응답으로 바로 낙관적 갱신할 수 있다.
export async function reactToComment(commentId, emoji, reactorSecret) {
  return withLegacyFallback(
    'reactToComment',
    () => rpc('react_to_comment_v2', {
      p_comment_id: commentId,
      p_emoji: emoji,
      p_reactor_secret: reactorSecret,
    }),
    () => rpc('react_to_comment', {
      p_comment_id: commentId,
      p_emoji: emoji,
      p_reactor_secret: reactorSecret,
    }),
  )
}

export async function getNearbyChatMessages({
  lat,
  lng,
  radiusMeters = 1000,
  limit = 200,
  before = null,
}) {
  const rows = await withLegacyFallback(
    'getNearbyChatMessages',
    () => rpcRows('get_nearby_chat_messages_v2', {
      p_lat: lat,
      p_lng: lng,
      p_radius_meters: radiusMeters,
      p_limit: limit,
      p_before: before,
    }),
    async () => {
      const boundedLimit = Math.min(Math.max(Number(limit) || 1, 1), 200)
      const boundedRadius = Math.min(Math.max(Number(radiusMeters) || 1, 1), 2000)
      let query = requireSupabase()
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(boundedLimit)
      if (before) query = query.lt('created_at', before)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).filter((message) => (
        Number.isFinite(message.lat)
        && Number.isFinite(message.lng)
        && getDistanceMeters(lat, lng, message.lat, message.lng) <= boundedRadius
      ))
    },
  )

  return [...rows].reverse()
}

export function watchNearbyChatMessages({
  lat,
  lng,
  radiusMeters = 1000,
  intervalMs = 5000,
  onMessages,
  onError,
  onStatus,
}) {
  let stopped = false
  let timer = null
  let running = false

  const refresh = async () => {
    if (stopped || running) return
    running = true
    onStatus?.('CONNECTING', null)
    try {
      const messages = await getNearbyChatMessages({ lat, lng, radiusMeters })
      if (!stopped) {
        onMessages?.(messages)
        onStatus?.('SUBSCRIBED', null)
      }
    } catch (error) {
      if (!stopped) {
        onError?.(error)
        onStatus?.('CHANNEL_ERROR', error)
      }
    } finally {
      running = false
    }
  }

  refresh()
  timer = globalThis.setInterval(refresh, Math.max(1000, intervalMs))

  return () => {
    stopped = true
    if (timer != null) globalThis.clearInterval(timer)
    onStatus?.('CLOSED', null)
  }
}

// Kept as an explicit migration aid. Calling it without a location is no longer privacy-safe.
export async function getChatMessages(options) {
  if (!options) throw new TypeError('getNearbyChatMessages({ lat, lng })를 사용해야 합니다.')
  return getNearbyChatMessages(options)
}

export async function sendChatMessage({ id = randomId(), actorToken, lat, lng, content }) {
  return withLegacyFallback(
    'sendChatMessage',
    () => rpc('send_chat_message_v2', {
      p_message_id: id,
      p_actor_token: actorTokenOrDefault(actorToken),
      p_lat: lat,
      p_lng: lng,
      p_content: content,
    }),
    async () => {
      const { data, error } = await requireSupabase()
        .from('chat_messages')
        .insert({ id, lat, lng, content })
        .select()
        .single()
      if (error) throw error
      return data
    },
  )
}

// Global chat postgres_changes exposed exact coordinates, so v2 deliberately has no equivalent.
export function subscribeToChatMessages(_onInsert, onStatus) {
  queueMicrotask(() => onStatus?.('CLOSED', new Error('watchNearbyChatMessages를 사용해야 합니다.')))
  return () => {}
}

// 웹 푸시 구독 + 알림 설정(관심 지역/키워드/조용한 시간)을 device_secret 기준으로 저장/갱신한다.
// device_secret 원문은 localStorage에만 있고 서버에는 SHA-256 hash로 저장한다.
export async function upsertPushSubscription({
  deviceSecret,
  endpoint,
  p256dh,
  auth,
  interestAreas,
  keywords,
  quietStart,
  quietEnd,
}) {
  const params = {
    p_device_secret: deviceSecret,
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_interest_areas: interestAreas,
    p_keywords: keywords,
    p_quiet_start: quietStart,
    p_quiet_end: quietEnd,
  }
  await withLegacyFallback(
    'upsertPushSubscription',
    () => rpc('upsert_push_subscription_v2', params),
    () => rpc('upsert_push_subscription', params),
  )
}

// 알림을 끌 때 서버에 저장된 구독을 지운다.
export async function deletePushSubscription(deviceSecret) {
  return withLegacyFallback(
    'deletePushSubscription',
    () => rpc('delete_push_subscription_v2', { p_device_secret: deviceSecret }),
    () => rpc('delete_push_subscription', { p_device_secret: deviceSecret }),
  )
}

// posts 테이블의 등록(INSERT)/수정(UPDATE)/삭제(DELETE)를 실시간으로 구독한다. 구독 해제 함수를 반환한다.
export function subscribeToPostChanges({ onInsert, onUpdate, onDelete, onStatus } = {}) {
  if (!supabase) return unavailableSubscription(onStatus)

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

  return activateChannel(channel, onStatus)
}
