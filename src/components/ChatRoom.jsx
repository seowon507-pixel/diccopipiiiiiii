import { useEffect, useRef, useState } from 'react'
import { sendChatMessage, watchNearbyChatMessages } from '../supabaseClient'
import { getActorToken } from '../myPosts'
import { maybeFuzzLocation } from '../geoPrivacy'

const DEFAULT_RADIUS_METERS = 1000
const RADIUS_OPTIONS = [
  { meters: 500, label: '500m' },
  { meters: 1000, label: '1km' },
  { meters: 2000, label: '2km' },
]
const CONTENT_MAX_LENGTH = 300
const CHAT_POLL_INTERVAL_MS = 5000

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function createClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function mergeChatMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => {
    byId.set(message.id, { ...byId.get(message.id), ...message })
  })
  return [...byId.values()].sort((a, b) => {
    const timeDifference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return timeDifference || String(a.id).localeCompare(String(b.id))
  }).slice(-200)
}

export function isChatNearBottom(element, threshold = 80) {
  if (!element) return true
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
}

export function scrollChatToBottom(element) {
  if (!element) return
  const top = element.scrollHeight
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top })
  } else {
    element.scrollTop = top
  }
}

function locationMessage(status) {
  if (status === 'loading') return '현재 위치를 확인하고 있어요…'
  if (status === 'denied') return '위치 권한을 허용해야 동네 채팅을 사용할 수 있어요.'
  return '현재 위치를 확인해야 동네 채팅을 사용할 수 있어요.'
}

// 신뢰할 수 있는 현재 위치와 선택 반경의 메시지만 서버에서 조회하고 주기적으로 snapshot을 병합한다.
function ChatRoom({ active = true, displayLocation, trustedLocation, locationStatus, onRetryLocation }) {
  const [messages, setMessages] = useState([])
  const [messagesStatus, setMessagesStatus] = useState('idle')
  const [messagesError, setMessagesError] = useState(null)
  const [realtimeStatus, setRealtimeStatus] = useState('IDLE')
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [refreshGeneration, setRefreshGeneration] = useState(0)
  const listRef = useRef(null)
  const requestGenerationRef = useRef(0)
  const pendingMessageIdRef = useRef(null)
  const actorTokenRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const forceScrollRef = useRef(true)

  const readLocation = trustedLocation ?? displayLocation
  const readLat = readLocation?.lat
  const readLng = readLocation?.lng
  const trustedLat = trustedLocation?.lat
  const trustedLng = trustedLocation?.lng
  const hasReadLocation = Number.isFinite(readLat) && Number.isFinite(readLng)
  const hasTrustedLocation = Number.isFinite(trustedLat) && Number.isFinite(trustedLng)

  useEffect(() => {
    const generation = requestGenerationRef.current + 1
    requestGenerationRef.current = generation

    if (!active) {
      setRealtimeStatus('IDLE')
      return undefined
    }

    if (!hasReadLocation) {
      setMessages([])
      setMessagesStatus('idle')
      setMessagesError(null)
      setRealtimeStatus('IDLE')
      return undefined
    }

    let listening = true
    let stopWatching = () => {}

    setMessages([])
    setMessagesStatus('loading')
    setMessagesError(null)
    setRealtimeStatus('CONNECTING')
    forceScrollRef.current = true

    const acceptSnapshot = (snapshot) => {
      if (!listening || generation !== requestGenerationRef.current) return
      setMessages((current) => mergeChatMessages(current, Array.isArray(snapshot) ? snapshot : []))
      setMessagesStatus('ready')
      setMessagesError(null)
    }

    const handleError = (error) => {
      if (!listening || generation !== requestGenerationRef.current) return
      setMessagesError(error)
      setMessagesStatus((status) => (status === 'ready' ? status : 'error'))
    }

    try {
      stopWatching = watchNearbyChatMessages({
        lat: readLat,
        lng: readLng,
        radiusMeters,
        intervalMs: CHAT_POLL_INTERVAL_MS,
        onMessages: acceptSnapshot,
        onError: handleError,
        onStatus: (status) => {
          if (listening && generation === requestGenerationRef.current) setRealtimeStatus(status)
        },
      })
    } catch (error) {
      handleError(error)
    }

    return () => {
      listening = false
      if (typeof stopWatching === 'function') stopWatching()
    }
  }, [active, hasReadLocation, readLat, readLng, radiusMeters, refreshGeneration])

  useEffect(() => {
    const list = listRef.current
    if (!list || (!forceScrollRef.current && !stickToBottomRef.current)) return undefined
    const frame = window.requestAnimationFrame(() => {
      scrollChatToBottom(list)
      stickToBottomRef.current = true
      forceScrollRef.current = false
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages])

  async function handleSend(event) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !hasTrustedLocation) return

    const id = pendingMessageIdRef.current ?? createClientId()
    pendingMessageIdRef.current = id
    actorTokenRef.current ??= getActorToken()

    setSending(true)
    setSendError(null)
    try {
      // 공개되는 채팅 좌표는 위치 보호 설정에 따라 동네 수준으로 흐린다.
      const sendLocation = maybeFuzzLocation({ lat: trustedLat, lng: trustedLng })
      const created = await sendChatMessage({
        id,
        actorToken: actorTokenRef.current,
        lat: sendLocation.lat,
        lng: sendLocation.lng,
        content: trimmed,
      })
      forceScrollRef.current = true
      setMessages((current) => mergeChatMessages(current, [created]))
      setMessagesStatus('ready')
      setText('')
      pendingMessageIdRef.current = null
    } catch (error) {
      console.error('[ChatRoom] 메시지 전송 실패', error)
      setSendError(error)
    } finally {
      setSending(false)
    }
  }

  function handleTextChange(event) {
    if (event.target.value !== text) pendingMessageIdRef.current = null
    setText(event.target.value)
    setSendError(null)
  }

  return (
    <div className="chat-room">
      <header className="page-heading chat-room-heading">
        <span className="page-eyebrow">반경 안의 실시간 대화</span>
        <span className="chat-room-title-row">
          <h1 className="chat-room-title">동네 채팅</h1>
          <span className={`chat-live-indicator${realtimeStatus === 'SUBSCRIBED' ? ' online' : ''}`}>
            <span aria-hidden="true" /> {realtimeStatus === 'SUBSCRIBED' ? '연결됨' : '연결 중'}
          </span>
        </span>
        <p className="chat-room-subtitle">내 위치 기준으로 가까운 이웃과 가볍게 대화해요.</p>
      </header>

      <div className="chat-radius-row">
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option.meters}
            type="button"
            className={`chat-radius-chip${radiusMeters === option.meters ? ' active' : ''}`}
            aria-pressed={radiusMeters === option.meters}
            onClick={() => setRadiusMeters(option.meters)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div
        className="chat-room-messages"
        ref={listRef}
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(event) => {
          stickToBottomRef.current = isChatNearBottom(event.currentTarget)
        }}
      >
        {!hasTrustedLocation && (
          <div className="chat-room-empty">
            <p>{locationMessage(locationStatus)}</p>
            {hasReadLocation && <p>서울시청 주변 대화는 읽을 수 있지만 전송은 위치 확인 후 가능해요.</p>}
            {locationStatus !== 'loading' && onRetryLocation && (
              <button type="button" onClick={onRetryLocation}>위치 다시 확인</button>
            )}
          </div>
        )}
        {hasReadLocation && messagesStatus === 'loading' && (
          <p className="chat-room-empty" role="status">대화를 불러오는 중이에요…</p>
        )}
        {hasReadLocation && messagesStatus === 'error' && (
          <div className="chat-room-empty" role="alert">
            <p>대화를 불러오지 못했어요.</p>
            <button type="button" onClick={() => setRefreshGeneration((value) => value + 1)}>다시 시도</button>
          </div>
        )}
        {hasReadLocation && messagesStatus === 'ready' && messages.length === 0 && (
          <p className="chat-room-empty">아직 대화가 없어요. 첫 메시지를 남겨보세요.</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className="chat-message">
            <p className="chat-message-content">{message.content}</p>
            <span className="chat-message-time">{formatTime(message.created_at)}</span>
          </div>
        ))}
      </div>

      {messagesError && messagesStatus === 'ready' && (
        <p role="alert">최신 대화를 확인하지 못했어요. 연결되면 자동으로 다시 확인할게요.</p>
      )}
      {sendError && <p role="alert">메시지를 보내지 못했어요. 다시 시도해 주세요.</p>}

      <form className="chat-room-form" onSubmit={handleSend} data-connection-status={realtimeStatus}>
        <input
          className="chat-room-input"
          value={text}
          maxLength={CONTENT_MAX_LENGTH}
          placeholder={hasTrustedLocation ? '메시지를 입력하세요' : '위치 확인 후 입력할 수 있어요'}
          spellCheck="true"
          lang="ko"
          disabled={!hasTrustedLocation}
          onChange={handleTextChange}
        />
        <button
          type="submit"
          className="chat-room-send"
          disabled={sending || !text.trim() || !hasTrustedLocation}
        >
          {sending ? '전송 중' : '전송'}
        </button>
      </form>
    </div>
  )
}

export default ChatRoom
