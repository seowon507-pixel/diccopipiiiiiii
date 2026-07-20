// 첫 실행 시 위치 권한 팝업보다 먼저 뜨는 온보딩 화면.
// "이 앱이 뭔지 / 왜 위치가 필요한지"를 먼저 설명하고, 사용자가 직접 시작 버튼을 눌러야만
// App이 useUserLocation을 활성화해 브라우저 위치 권한을 요청한다(맥락 없는 팝업 강요 방지).
const FEATURES = [
  { emoji: '📍', title: '내 주변 실시간 소식', desc: '반경 1km 안의 웨이팅·혼잡·사건사고를 지도에서 바로 확인해요.' },
  { emoji: '💬', title: '동네 이웃과 대화', desc: '가까운 이웃들과 익명으로 질문하고 정보를 나눠요.' },
  { emoji: '🔒', title: '닉네임으로만 활동', desc: '이메일 인증만으로 시작하고, 동네에서는 닉네임으로만 활동해요. 위치는 소식을 찾는 데만 쓰여요.' },
]

function Onboarding({ onStart }) {
  return (
    <div className="onboarding">
      <div className="onboarding-body">
        <div className="onboarding-hero">
          <span className="onboarding-logo" aria-hidden="true">📍</span>
          <h1 className="onboarding-title">우리동네알림</h1>
          <p className="onboarding-tagline">우리 동네에서 지금 일어나는 일</p>
        </div>

        <ul className="onboarding-features">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="onboarding-feature">
              <span className="onboarding-feature-emoji" aria-hidden="true">{feature.emoji}</span>
              <div className="onboarding-feature-text">
                <p className="onboarding-feature-title">{feature.title}</p>
                <p className="onboarding-feature-desc">{feature.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="onboarding-footer">
        <button type="button" className="onboarding-start" onClick={onStart}>
          위치 켜고 시작하기
        </button>
        <p className="onboarding-note">
          시작을 누르면 위치 권한을 요청해요. 정확한 위치는 저장하지 않아요.
        </p>
      </div>
    </div>
  )
}

export default Onboarding
