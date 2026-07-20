import rawDummyData from '../dummy-data.json'
import { REALTIME_CATEGORIES } from './categories'
import { getDistanceMeters } from './geo'

export const DUMMY_CENTER = Object.freeze({ ...rawDummyData.center })

const postListeners = new Set()
const pinListeners = new Set()
const commentListeners = new Map()

let state
let postReactionKeys
let reportKeys
let commentReactionKeys

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function timestampFromMinutes(minutes, referenceTime) {
  return new Date(referenceTime - Number(minutes ?? 0) * 60 * 1000).toISOString()
}

function hydrateRelativeTimes(item, referenceTime) {
  const hydrated = {
    ...item,
    created_at: timestampFromMinutes(item.created_minutes_ago, referenceTime),
  }

  if (item.updated_minutes_ago != null) {
    hydrated.updated_at = timestampFromMinutes(item.updated_minutes_ago, referenceTime)
  }
  if (item.last_confirmed_minutes_ago != null) {
    hydrated.last_confirmed_at = timestampFromMinutes(item.last_confirmed_minutes_ago, referenceTime)
  }

  delete hydrated.created_minutes_ago
  delete hydrated.updated_minutes_ago
  delete hydrated.last_confirmed_minutes_ago
  return hydrated
}

function buildInitialState(referenceTime = Date.now()) {
  return {
    posts: rawDummyData.posts.map((post) => hydrateRelativeTimes(post, referenceTime)),
    pins: rawDummyData.pins.map((pin) => hydrateRelativeTimes(pin, referenceTime)),
    comments: rawDummyData.comments.map((comment) => hydrateRelativeTimes(comment, referenceTime)),
    chatMessages: rawDummyData.chat_messages.map((message) => hydrateRelativeTimes(message, referenceTime)),
  }
}

function emitPost(type, post) {
  postListeners.forEach((listener) => listener[type]?.(clone(post)))
}

function emitPin(type, pin) {
  pinListeners.forEach((listener) => listener[type]?.(clone(pin)))
}

function emitComment(postId, type, comment) {
  commentListeners.get(postId)?.forEach((listener) => listener[type]?.(clone(comment)))
}

function findPost(id) {
  const post = state.posts.find((item) => item.id === id)
  if (!post) throw new Error('샘플 게시글을 찾을 수 없습니다.')
  return post
}

function findComment(id) {
  const comment = state.comments.find((item) => item.id === id)
  if (!comment) throw new Error('샘플 댓글을 찾을 수 없습니다.')
  return comment
}

export function resetDummyData(referenceTime = Date.now()) {
  state = buildInitialState(referenceTime)
  postReactionKeys = new Set()
  reportKeys = new Set()
  commentReactionKeys = new Set()
}

resetDummyData()

export function getDummyPosts() {
  return clone(state.posts.filter((post) => !post.hidden))
}

export function createDummyPost({
  id,
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
}) {
  const existing = state.posts.find((post) => post.id === id)
  if (existing) return clone(existing)

  const hasAuthorLocation = Number.isFinite(authorLat) && Number.isFinite(authorLng)
  const resolvedPostType = postType ?? (
    hasAuthorLocation && getDistanceMeters(authorLat, authorLng, lat, lng) > 500
      ? 'external'
      : 'local'
  )
  const post = {
    id,
    lat,
    lng,
    category,
    title: title?.trim() || null,
    content: content.trim(),
    confirm_count: 0,
    likes_count: 0,
    post_type: resolvedPostType,
    image_url: imageUrl ?? null,
    icon: icon ?? null,
    created_at: new Date().toISOString(),
    updated_at: null,
    last_confirmed_at: null,
    report_count: 0,
    hidden: false,
    is_dummy: true,
  }
  state.posts.unshift(post)
  emitPost('onInsert', post)
  return clone(post)
}

export function updateDummyPost(id, changes) {
  const post = findPost(id)
  Object.assign(post, {
    category: changes.category,
    title: changes.title?.trim() || null,
    content: changes.content.trim(),
    image_url: changes.imageUrl ?? null,
    icon: changes.icon ?? null,
    updated_at: new Date().toISOString(),
  })
  emitPost('onUpdate', post)
  return clone(post)
}

export function deleteDummyPost(id) {
  const index = state.posts.findIndex((post) => post.id === id)
  if (index < 0) return false
  const [deleted] = state.posts.splice(index, 1)
  state.comments = state.comments.filter((comment) => comment.post_id !== id)
  emitPost('onDelete', deleted)
  return true
}

function reactToDummyPost(id, actorToken, kind) {
  const post = findPost(id)
  const acceptsReaction = kind === 'confirm'
    ? REALTIME_CATEGORIES.includes(post.category)
    : !REALTIME_CATEGORIES.includes(post.category)
  if (!acceptsReaction) throw new Error('이 카테고리에는 해당 반응을 남길 수 없습니다.')

  const key = `${kind}:${id}:${actorToken ?? 'demo-actor'}`
  if (!postReactionKeys.has(key)) {
    postReactionKeys.add(key)
    if (kind === 'confirm') {
      post.confirm_count += 1
      post.last_confirmed_at = new Date().toISOString()
    } else {
      post.likes_count += 1
    }
    emitPost('onUpdate', post)
  }
  return clone(post)
}

export function confirmDummyPost(id, actorToken) {
  return reactToDummyPost(id, actorToken, 'confirm')
}

export function likeDummyPost(id, actorToken) {
  return reactToDummyPost(id, actorToken, 'like')
}

export function subscribeToDummyPosts(listener = {}) {
  postListeners.add(listener)
  queueMicrotask(() => listener.onStatus?.('SUBSCRIBED', null))
  return () => {
    postListeners.delete(listener)
    listener.onStatus?.('CLOSED', null)
  }
}

export function getDummyPins() {
  return clone(state.pins)
}

export function createDummyPin({ id, lat, lng }) {
  const existing = state.pins.find((pin) => pin.id === id)
  if (existing) return clone(existing)
  const pin = { id, lat, lng, created_at: new Date().toISOString(), is_dummy: true }
  state.pins.push(pin)
  emitPin('onInsert', pin)
  return clone(pin)
}

export function deleteDummyPin(id) {
  const index = state.pins.findIndex((pin) => pin.id === id)
  if (index < 0) return false
  const [deleted] = state.pins.splice(index, 1)
  emitPin('onDelete', deleted)
  return true
}

export function deleteExpiredDummyPins(referenceTime = Date.now()) {
  const expired = state.pins.filter((pin) => referenceTime - new Date(pin.created_at).getTime() >= 60 * 60 * 1000)
  expired.forEach((pin) => deleteDummyPin(pin.id))
  return expired.length
}

export function subscribeToDummyPins(listener = {}) {
  pinListeners.add(listener)
  queueMicrotask(() => listener.onStatus?.('SUBSCRIBED', null))
  return () => {
    pinListeners.delete(listener)
    listener.onStatus?.('CLOSED', null)
  }
}

export function getDummyComments(postId) {
  return clone(state.comments
    .filter((comment) => comment.post_id === postId && !comment.hidden)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
}

export function createDummyComment({ id, postId, content, parentCommentId = null }) {
  const existing = state.comments.find((comment) => comment.id === id)
  if (existing) return clone(existing)
  if (parentCommentId) {
    const parent = findComment(parentCommentId)
    if (parent.post_id !== postId || parent.parent_comment_id) {
      throw new Error('샘플 답글은 같은 게시글의 최상위 댓글에만 작성할 수 있습니다.')
    }
  }
  const comment = {
    id,
    post_id: postId,
    content: content.trim(),
    parent_comment_id: parentCommentId,
    reactions: {},
    report_count: 0,
    hidden: false,
    created_at: new Date().toISOString(),
    is_dummy: true,
  }
  state.comments.push(comment)
  emitComment(postId, 'onInsert', comment)
  return clone(comment)
}

function reportDummyTarget(type, id, reporterSecret) {
  const target = type === 'post' ? findPost(id) : findComment(id)
  const key = `${type}:${id}:${reporterSecret ?? 'demo-reporter'}`
  if (!reportKeys.has(key)) {
    reportKeys.add(key)
    target.report_count += 1
    target.hidden = target.report_count >= 5
    if (type === 'post') emitPost('onUpdate', target)
    else emitComment(target.post_id, 'onUpdate', target)
  }
  return { report_count: target.report_count, hidden: target.hidden }
}

export function reportDummyPost(id, reporterSecret) {
  return reportDummyTarget('post', id, reporterSecret)
}

export function reportDummyComment(id, reporterSecret) {
  return reportDummyTarget('comment', id, reporterSecret)
}

export function reactToDummyComment(id, emoji, reactorSecret) {
  const comment = findComment(id)
  const key = `${id}:${emoji}:${reactorSecret ?? 'demo-reactor'}`
  const currentCount = Number(comment.reactions?.[emoji] ?? 0)
  const reacted = !commentReactionKeys.has(key)
  if (reacted) {
    commentReactionKeys.add(key)
    comment.reactions[emoji] = currentCount + 1
  } else {
    commentReactionKeys.delete(key)
    comment.reactions[emoji] = Math.max(0, currentCount - 1)
  }
  emitComment(comment.post_id, 'onUpdate', comment)
  return { count: comment.reactions[emoji], reacted }
}

export function subscribeToDummyComments(postId, listener = {}) {
  if (!commentListeners.has(postId)) commentListeners.set(postId, new Set())
  commentListeners.get(postId).add(listener)
  queueMicrotask(() => listener.onStatus?.('SUBSCRIBED', null))
  return () => {
    const listeners = commentListeners.get(postId)
    listeners?.delete(listener)
    if (listeners?.size === 0) commentListeners.delete(postId)
    listener.onStatus?.('CLOSED', null)
  }
}

export function getDummyNearbyChatMessages({ lat, lng, radiusMeters = 1000, limit = 200, before = null }) {
  const beforeTime = before ? new Date(before).getTime() : Number.POSITIVE_INFINITY
  return clone(state.chatMessages
    .filter((message) => (
      new Date(message.created_at).getTime() < beforeTime
      && getDistanceMeters(lat, lng, message.lat, message.lng) <= radiusMeters
    ))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-Math.min(Math.max(Number(limit) || 1, 1), 200)))
}

export function sendDummyChatMessage({ id, lat, lng, content }) {
  const existing = state.chatMessages.find((message) => message.id === id)
  if (existing) return clone(existing)
  const message = {
    id,
    lat,
    lng,
    content: content.trim(),
    created_at: new Date().toISOString(),
    is_dummy: true,
  }
  state.chatMessages.push(message)
  return clone(message)
}
