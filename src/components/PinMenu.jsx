import { useEffect, useRef } from 'react'

// 아직 글이 없는 "빈 핀"을 클릭했을 때 뜨는 액션 메뉴.
function PinMenu({ onWrite, onDelete, onClose, deleting, canDelete = false, errorMessage = null }) {
  const dialogRef = useRef(null)
  const firstActionRef = useRef(null)
  const closeRef = useRef(onClose)
  const deletingRef = useRef(deleting)
  closeRef.current = onClose
  deletingRef.current = deleting

  useEffect(() => {
    const previousFocus = document.activeElement
    firstActionRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (!deletingRef.current) closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [])

  function handleClose() {
    if (!deleting) onClose()
  }

  return (
    <div className="pin-menu-backdrop" onClick={(event) => event.target === event.currentTarget && handleClose()}>
      <div
        ref={dialogRef}
        className="pin-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-menu-title"
        aria-describedby={!canDelete ? 'pin-menu-owner-note' : undefined}
      >
        <p id="pin-menu-title" className="pin-menu-title">이 위치에서 무엇을 할까요?</p>

        <button ref={firstActionRef} type="button" className="pin-menu-action" onClick={onWrite}>
          ✏️ 글쓰기
        </button>
        {canDelete ? (
          <button
            type="button"
            className="pin-menu-action pin-menu-delete"
            disabled={deleting}
            onClick={onDelete}
          >
            {deleting ? '삭제 중...' : '🗑 핀 삭제'}
          </button>
        ) : (
          <p id="pin-menu-owner-note" className="pin-menu-owner-note" role="status">
            다른 사용자가 만든 핀이라 삭제할 수 없어요.
          </p>
        )}

        {errorMessage && <p className="dialog-error" role="alert">{errorMessage}</p>}

        <button type="button" className="pin-menu-cancel" disabled={deleting} onClick={handleClose}>
          취소
        </button>
      </div>
    </div>
  )
}

export default PinMenu
