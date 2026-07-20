import { useEffect } from 'react'

// App.jsx가 {toast && <Toast key={toast.key} .../>}로 조건부 렌더링한다 — key가 매번 새 값이라
// 같은 문구가 연달아 떠도 새로 mount되어 타이머가 처음부터 다시 시작된다.
// mount 시 한 번만 타이머를 건다(빈 의존성 배열) — onDismiss는 App이 매 렌더마다 새로 만드는
// 인라인 함수라, 여기 의존성에 넣으면 앱이 리렌더될 때마다(신고/게시글 실시간 갱신 등)
// 타이머가 계속 리셋되어 토스트가 duration보다 오래 떠 있게 된다.
function Toast({ message, duration = 2200, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}

export default Toast
