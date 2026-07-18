import { useEffect, useMemo, useRef, useState } from 'react'
import { getChatMessages, sendChatMessage, subscribeToChatMessages } from '../supabaseClient'
import { getDistanceMeters } from '../geo'
import { maybeFuzzLocation } from '../geoPrivacy'

const DEFAULT_RADIUS_METERS = 1000
const RADIUS_OPTIONS = [
  { meters: 500, label: '500m' },
  { meters: 1000, label: '1km' },
  { meters: 2000, label: '2km' },
]
const CONTENT_MAX_LENGTH = 300

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// 게시글 댓글과 별개로, 내 위치 기준 반경 이내 이웃과 실시간으로 대화하는 동네 전체 공용 채팅방.
// 서버에서는 최근 200개를 반경 상관없이 통째로 받아두고(rawMessages), 화면에 보일 것만
// radiusMeters로 클라이언트에서 걸러낸다 — 반경을 바꿔도 재요청 없이 즉시 다시 걸러진다.
function ChatRoom({ userLocation }) {
  const [rawMessages, setRawMessages] = useState([])
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (!userLocation) return
    let cancelled = false

    getChatMessages().then((data) => {
      if (!cancelled) setRawMessages(data)
    })

    const unsubscribe = subscribeToChatMessages((newMessage) => {
      setRawMessages((prev) => (prev.some((msg) => msg.id === newMessage.id) ? prev : [...prev, newMessage]))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [userLocation])

  const messages = useMemo(() => {
    if (!userLocation) return []
    return rawMessages.filter((msg) => (
      getDistanceMeters(userLocation.lat, userLocation.lng, msg.lat, msg.lng) <= radiusMeters
    ))
  }, [rawMessages, userLocation, radiusMeters])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function handleSend(event) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !userLocation) return

    setSending(true)
    try {
      // 채팅은 항상 내 현재 위치 기반이라, 위치 보호가 켜져 있으면 대략적인 위치로 흐려서 보낸다.
      // (반경 필터는 흐려진 위치 기준으로 동작 — 오차 80~200m라 동네 채팅 취지엔 영향 미미.)
      const sendLocation = maybeFuzzLocation(userLocation)
      await sendChatMessage({ lat: sendLocation.lat, lng: sendLocation.lng, content: trimmed })
      setText('')
    } catch (err) {
      console.error('[ChatRoom] 메시지 전송 실패', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-room">
      <h1 className="chat-room-title">동네 채팅</h1>
      <p className="chat-room-subtitle">내 위치 기준 반경 이내 이웃과 실시간으로 대화해요.</p>

      <div className="chat-radius-row">
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option.meters}
            type="button"
            className={`chat-radius-chip${radiusMeters === option.meters ? ' active' : ''}`}
            onClick={() => setRadiusMeters(option.meters)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="chat-room-messages" ref={listRef}>
        {messages.length === 0 && <p className="chat-room-empty">아직 대화가 없어요. 첫 메시지를 남겨보세요.</p>}
        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            <p className="chat-message-content">{msg.content}</p>
            <span className="chat-message-time">{formatTime(msg.created_at)}</span>
          </div>
        ))}
      </div>

      <form className="chat-room-form" onSubmit={handleSend}>
        <input
          className="chat-room-input"
          value={text}
          maxLength={CONTENT_MAX_LENGTH}
          placeholder="메시지를 입력하세요"
          spellCheck="true"
          lang="ko"
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className="chat-room-send" disabled={sending || !text.trim()}>
          전송
        </button>
      </form>
    </div>
  )
}

export default ChatRoom
