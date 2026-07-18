import { createClient } from '@supabase/supabase-js'
import dummyData from '../dummy-data.json'
import { generateOwnerSecret, getOrCreateActorToken } from './myPosts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const useDummyData = import.meta.env.DEV && import.meta.env.VITE_USE_DUMMY_DATA === 'true'

const POST_IMAGE_BUCKET = 'post-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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
export const supabase = backendConfigurationError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)

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
}) {
  if (!ownerSecret) throw new TypeError('ownerSecret is required')

  return rpc('create_post_v2', {
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
  })
}

export async function getPins() {
  const { data, error } = await requireSupabase().from('pins').select('*')
  if (error) throw error
  return data
}

export async function createPin({ id = randomId(), actorToken, lat, lng, ownerSecret }) {
  if (!ownerSecret) throw new TypeError('ownerSecret is required')

  return rpc('create_pin_v2', {
    p_pin_id: id,
    p_actor_token: actorTokenOrDefault(actorToken),
    p_lat: lat,
    p_lng: lng,
    p_owner_secret: ownerSecret,
  })
}

export async function deletePin(id, ownerSecret) {
  return rpc('delete_own_pin_v2', {
    p_pin_id: id,
    p_owner_secret: ownerSecret,
  })
}

// The v2 RPC owns the retention constant. A caller can no longer lower it to mass-delete fresh pins.
export async function deleteExpiredPins() {
  await rpc('delete_expired_pins_v2', {})
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
  return rpc('delete_own_post_v2', {
    p_post_id: id,
    p_owner_secret: ownerSecret,
  })
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

  return rpc('update_own_post_v2', {
    p_post_id: id,
    p_owner_secret: ownerSecret,
    p_category: category,
    p_title: title,
    p_content: content,
    p_image_url: imageUrl ?? null,
    p_icon: icon ?? null,
  })
}

export async function incrementConfirmCount(id, actorToken) {
  return rpc('confirm_post_v2', {
    p_post_id: id,
    p_actor_token: actorTokenOrDefault(actorToken),
  })
}

export async function incrementLikes(id, actorToken) {
  return rpc('like_post_v2', {
    p_post_id: id,
    p_actor_token: actorTokenOrDefault(actorToken),
  })
}

export async function getComments(postId) {
  const { data, error } = await requireSupabase()
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function createComment(postId, content, { id = randomId(), actorToken } = {}) {
  return rpc('create_comment_v2', {
    p_comment_id: id,
    p_post_id: postId,
    p_actor_token: actorTokenOrDefault(actorToken),
    p_content: content,
  })
}

export function subscribeToComments(postId, onInsert, onStatus) {
  if (!supabase) return unavailableSubscription(onStatus)

  const channel = supabase
    .channel(`comments-${postId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
      (payload) => onInsert?.(payload.new),
    )

  return activateChannel(channel, onStatus)
}

export async function getNearbyChatMessages({
  lat,
  lng,
  radiusMeters = 1000,
  limit = 200,
  before = null,
}) {
  const rows = await rpcRows('get_nearby_chat_messages_v2', {
    p_lat: lat,
    p_lng: lng,
    p_radius_meters: radiusMeters,
    p_limit: limit,
    p_before: before,
  })

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
  return rpc('send_chat_message_v2', {
    p_message_id: id,
    p_actor_token: actorTokenOrDefault(actorToken),
    p_lat: lat,
    p_lng: lng,
    p_content: content,
  })
}

// Global chat postgres_changes exposed exact coordinates, so v2 deliberately has no equivalent.
export function subscribeToChatMessages(_onInsert, onStatus) {
  queueMicrotask(() => onStatus?.('CLOSED', new Error('watchNearbyChatMessages를 사용해야 합니다.')))
  return () => {}
}

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
