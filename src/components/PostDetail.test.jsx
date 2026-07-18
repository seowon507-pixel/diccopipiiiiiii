import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostDetail, { mergeComments } from './PostDetail'

vi.mock('../supabaseClient', () => ({
  getComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn(),
  subscribeToComments: vi.fn(() => () => {}),
}))

describe('mergeComments', () => {
  it('deduplicates a mutation response and realtime echo', () => {
    const comment = { id: 'c1', content: 'hello', created_at: '2026-07-18T00:00:00.000Z' }
    const result = mergeComments([comment], [{ ...comment, content: 'hello' }])

    expect(result).toEqual([comment])
  })
})

describe('PostDetail owner actions', () => {
  const post = {
    id: 'post-1',
    category: '일상',
    title: '내 글',
    content: '내용',
    created_at: '2026-07-18T00:00:00.000Z',
    likes_count: 0,
    confirm_count: 0,
  }

  it('provides direct edit and confirms before deleting without losing keyboard focus', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <PostDetail
        post={post}
        onClose={vi.fn()}
        onLike={vi.fn()}
        onConfirm={vi.fn()}
        isMine
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '내 글 수정하기' }))
    expect(onEdit).toHaveBeenCalledOnce()

    const deleteTrigger = screen.getByRole('button', { name: '내 글 삭제하기' })
    deleteTrigger.focus()
    fireEvent.click(deleteTrigger)
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText('정말 삭제할까요?')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('button', { name: '취소' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '내 글 삭제하기' })).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: '내 글 삭제하기' }))

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
