import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  signUpWithPassword: vi.fn(),
  signInWithPassword: vi.fn(),
  sendLoginLink: vi.fn(),
  checkUsernameAvailable: vi.fn(),
  saveUsername: vi.fn(),
  isValidUsernameFormat: vi.fn((value) => /^[a-zA-Z0-9_]{2,20}$/.test(value.trim())),
}))

vi.mock('../auth', () => authMocks)

import AuthGate from './AuthGate'

describe('AuthGate accessibility and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('모든 회원가입 입력에 접근 가능한 이름을 제공한다', () => {
    render(<AuthGate session={null} />)

    expect(screen.getByLabelText('회원가입 이메일')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('새 비밀번호 확인')).toHaveAttribute('type', 'password')
  })

  it('방향키로 회원가입과 로그인 탭을 전환하고 초점을 이동한다', async () => {
    const user = userEvent.setup()
    render(<AuthGate session={null} />)
    const signupTab = screen.getByRole('tab', { name: '회원가입' })

    signupTab.focus()
    await user.keyboard('{ArrowRight}')

    const loginTab = screen.getByRole('tab', { name: '로그인' })
    expect(loginTab).toHaveAttribute('aria-selected', 'true')
    expect(loginTab).toHaveFocus()
    expect(screen.getByLabelText('로그인 이메일')).toBeInTheDocument()
  })

  it('비밀번호 불일치를 서버 호출 전에 차단한다', async () => {
    const user = userEvent.setup()
    render(<AuthGate session={null} />)

    await user.type(screen.getByLabelText('회원가입 이메일'), 'member@example.com')
    await user.type(screen.getByLabelText('새 비밀번호'), 'password1')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'password2')
    await user.click(screen.getByRole('button', { name: '회원가입' }))

    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호가 서로 달라요.')
    expect(authMocks.signUpWithPassword).not.toHaveBeenCalled()
  })

  it('세션 오류를 빈 화면 대신 로그인 게이트에서 알린다', () => {
    render(<AuthGate session={null} statusError="세션을 확인하지 못했습니다." />)

    expect(screen.getByRole('alert')).toHaveTextContent('세션을 확인하지 못했습니다.')
  })
})
