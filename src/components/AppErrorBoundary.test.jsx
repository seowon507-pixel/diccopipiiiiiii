import { createRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppErrorBoundary from './AppErrorBoundary.jsx'

describe('AppErrorBoundary', () => {
  it('shows a recoverable error screen instead of a blank root', () => {
    const boundaryRef = createRef()

    render(
      <AppErrorBoundary ref={boundaryRef}>
        <p>정상 화면</p>
      </AppErrorBoundary>,
    )

    act(() => {
      boundaryRef.current.setState(AppErrorBoundary.getDerivedStateFromError(new Error('render failed')))
    })

    expect(screen.getByRole('alert')).toHaveTextContent('화면을 불러오지 못했어요')
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeEnabled()
  })
})
