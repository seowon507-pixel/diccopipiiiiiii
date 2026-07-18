// 아직 글이 없는 "빈 핀"을 클릭했을 때 뜨는 액션 메뉴.
function PinMenu({ onWrite, onDelete, onClose, deleting }) {
  return (
    <div className="pin-menu-backdrop" onClick={onClose}>
      <div className="pin-menu" onClick={(event) => event.stopPropagation()}>
        <p className="pin-menu-title">이 위치에서 무엇을 할까요?</p>

        <button type="button" className="pin-menu-action" onClick={onWrite}>
          ✏️ 글쓰기
        </button>
        <button
          type="button"
          className="pin-menu-action pin-menu-delete"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? '삭제 중...' : '🗑 핀 삭제'}
        </button>

        <button type="button" className="pin-menu-cancel" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  )
}

export default PinMenu
