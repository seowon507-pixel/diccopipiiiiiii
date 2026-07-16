import { useEffect, useRef, useState } from 'react'
import { getChatMessages, sendChatMessage, subscribeToChatMessages } from '../supabaseClient'
import { getDistanceMeters } from '../geo'

const NEARBY_RADIUS_METERS = 1000
const CONTENT_MAX_LENGTH = 300

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// 게시글 댓글과 별개로, 내 위치 1km 이내 이웃과 실시간으로 대화하는 동네 전체 공용 채팅방.
function ChatRoom({ userLocation }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (!userLocation) return
    let cancelled = false

    getChatMessages().then((data) => {
      if (cancelled) return
      setMessages(data.filter((msg) => (
        getDistanceMeters(userLocation.lat, userLocation.lng, msg.lat, msg.lng) <= NEARBY_RADIUS_METERS
      )))
    })

    const unsubscribe = subscribeToChatMessages((newMessage) => {
      const distance = getDistanceMeters(userLocation.lat, userLocation.lng, newMessage.lat, newMessage.lng)
      if (distance > NEARBY_RADIUS_METERS) return
      setMessages((prev) => (prev.some((msg) => msg.id === newMessage.id) ? prev : [...prev, newMessage]))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [userLocation])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function handleSend(event) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !userLocation) return

    setSending(true)
    try {
      await sendChatMessage({ lat: userLocation.lat, lng: userLocation.lng, content: trimmed })
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
      <p className="chat-room-subtitle">내 위치 1km 이내 이웃과 실시간으로 대화해요.</p>

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
