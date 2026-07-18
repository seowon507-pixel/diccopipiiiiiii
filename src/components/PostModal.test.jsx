import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostModal from './PostModal'

const baseProps = {
  open: true,
  submitting: false,
  onSubmit: vi.fn(),
  onClose: vi.fn(),
}

describe('PostModal', () => {
  it('does not steal focus again when its parent rerenders', async () => {
    const { rerender } = render(<PostModal {...baseProps} />)
    const content = screen.getByPlaceholderText('내용을 입력해주세요')
    content.focus()

    rerender(<PostModal {...baseProps} onClose={vi.fn()} submitting />)

    expect(content).toHaveFocus()
  })

  it('rejects mobile image formats that the uploader cannot store', () => {
    const { container } = render(<PostModal {...baseProps} />)
    const input = container.querySelector('input[type="file"]')
    const heic = new File(['image'], 'photo.heic', { type: 'image/heic' })

    fireEvent.change(input, { target: { files: [heic] } })

    expect(screen.getByText('JPG, PNG, WebP, GIF 이미지만 올릴 수 있어요.')).toBeInTheDocument()
    expect(input).toHaveAttribute('accept', expect.stringContaining('.jpg'))
  })
})
