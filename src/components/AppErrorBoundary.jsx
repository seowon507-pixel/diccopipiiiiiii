import { Component } from 'react'

// 예상하지 못한 렌더링 오류가 발생해도 사용자가 원인을 알 수 없는 빈 화면에 갇히지 않게 한다.
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] 복구되지 않은 화면 오류', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-fatal-error" role="alert">
        <h1>화면을 불러오지 못했어요</h1>
        <p>잠시 후 다시 시도해 주세요. 계속 문제가 생기면 연결 설정을 확인해 주세요.</p>
        <button type="button" onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
        {import.meta.env.DEV && <pre>{this.state.error.message}</pre>}
      </main>
    )
  }
}

export default AppErrorBoundary
