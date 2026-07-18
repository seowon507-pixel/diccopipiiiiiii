import { useEffect, useRef, useState } from 'react'
import { getNearbyChatMessages, sendChatMessage, watchNearbyChatMessages } from '../supabaseClient'
import { getActorToken } from '../myPosts'

const NEARBY_RADIUS_METERS = 1000
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

function locationMessage(status) {
  if (status === 'loading') return '현재 위치를 확인하고 있어요…'
  if (status === 'denied') return '위치 권한을 허용해야 동네 채팅을 사용할 수 있어요.'
  return '현재 위치를 확인해야 동네 채팅을 사용할 수 있어요.'
}

// 신뢰할 수 있는 현재 위치 1km 이내 메시지만 조회하고 주기적으로 서버 snapshot과 병합한다.
function ChatRoom({ trustedLocation, locationStatus, onRetryLocation }) {
  const [messages, setMessages] = useState([])
  const [messagesStatus, setMessagesStatus] = useState('idle')
  const [messagesError, setMessagesError] = useState(null)
  const [realtimeStatus, setRealtimeStatus] = useState('IDLE')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [refreshGeneration, setRefreshGeneration] = useState(0)
  const listRef = useRef(null)
  const requestGenerationRef = useRef(0)
  const pendingMessageIdRef = useRef(null)
  const actorTokenRef = useRef(null)

  const lat = trustedLocation?.lat
  const lng = trustedLocation?.lng
  const hasTrustedLocation = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    const generation = requestGenerationRef.current + 1
    requestGenerationRef.current = generation

    if (!hasTrustedLocation) {
      setMessages([])
      setMessagesStatus('idle')
      setMessagesError(null)
      setRealtimeStatus('IDLE')
      return undefined
    }

    let active = true
    let stopWatching = () => {}

    setMessages([])
    setMessagesStatus('loading')
    setMessagesError(null)
    setRealtimeStatus('CONNECTING')

    const acceptSnapshot = (snapshot) => {
      if (!active || generation !== requestGenerationRef.current) return
      setMessages((current) => mergeChatMessages(current, Array.isArray(snapshot) ? snapshot : []))
      setMessagesStatus('ready')
      setMessagesError(null)
    }

    const handleError = (error) => {
      if (!active || generation !== requestGenerationRef.current) return
      setMessagesError(error)
      setMessagesStatus((status) => (status === 'ready' ? status : 'error'))
    }

    try {
      stopWatching = watchNearbyChatMessages({
        lat,
        lng,
        radiusMeters: NEARBY_RADIUS_METERS,
        intervalMs: CHAT_POLL_INTERVAL_MS,
        onMessages: acceptSnapshot,
        onError: handleError,
        onStatus: (status) => {
          if (active && generation === requestGenerationRef.current) setRealtimeStatus(status)
        },
      })
    } catch (error) {
      handleError(error)
    }

    getNearbyChatMessages({
      lat,
      lng,
      radiusMeters: NEARBY_RADIUS_METERS,
      limit: 200,
    }).then(acceptSnapshot).catch(handleError)

    return () => {
      active = false
      if (typeof stopWatching === 'function') stopWatching()
    }
  }, [hasTrustedLocation, lat, lng, refreshGeneration])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
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
      const created = await sendChatMessage({
        id,
        actorToken: actorTokenRef.current,
        lat,
        lng,
        content: trimmed,
      })
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
      <h1 className="chat-room-title">동네 채팅</h1>
      <p className="chat-room-subtitle">내 위치 1km 이내 이웃과 대화해요.</p>

      <div className="chat-room-messages" ref={listRef}>
        {!hasTrustedLocation && (
          <div className="chat-room-empty">
            <p>{locationMessage(locationStatus)}</p>
            {locationStatus !== 'loading' && onRetryLocation && (
              <button type="button" onClick={onRetryLocation}>위치 다시 확인</button>
            )}
          </div>
        )}
        {hasTrustedLocation && messagesStatus === 'loading' && (
          <p className="chat-room-empty" role="status">대화를 불러오는 중이에요…</p>
        )}
        {hasTrustedLocation && messagesStatus === 'error' && (
          <div className="chat-room-empty" role="alert">
            <p>대화를 불러오지 못했어요.</p>
            <button type="button" onClick={() => setRefreshGeneration((value) => value + 1)}>다시 시도</button>
          </div>
        )}
        {hasTrustedLocation && messagesStatus === 'ready' && messages.length === 0 && (
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
